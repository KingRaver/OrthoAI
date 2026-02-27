import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatCompletionMessageParam } from 'openai/resources/chat';
import type { StrategyDecision } from '@/app/lib/strategy/types';
import { executeWithWorkflow, MultiModelOrchestrator } from '@/app/lib/strategy/orchestrator';
import { ModelChainWorkflow } from '@/app/lib/strategy/workflows/chain';
import { EnsembleWorkflow } from '@/app/lib/strategy/workflows/ensemble';
import { ResourceConstraints, withResourceConstraints } from '@/app/lib/strategy/resources/constraints';

function baseDecision(): StrategyDecision {
  return {
    id: 'd1',
    strategyName: 'workflow',
    timestamp: new Date(),
    selectedModel: 'biomistral-7b-instruct',
    temperature: 0.3,
    maxTokens: 8000,
    streaming: false,
    enableTools: false,
    maxToolLoops: 0,
    reasoning: 'test',
    confidence: 0.9,
    complexityScore: 60,
  };
}

describe('strategy orchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('executes combined ensemble + chain workflow and aggregates token usage', async () => {
    // ensemble: 110 + 90 = 200 tokens; chain: 200 tokens; combined total = 400
    const ensembleSpy = vi.spyOn(EnsembleWorkflow, 'executeEnsemble').mockResolvedValue({
      response: 'ensemble-draft',
      confidence: 0.81,
      votes: [
        { model: 'biomistral-7b-instruct', response: 'r1', tokensUsed: 110 },
        { model: 'biogpt', response: 'r2', tokensUsed: 90 },
      ],
      voteBreakdown: {
        selectedModel: 'biomistral-7b-instruct',
        strategy: 'weighted',
        modelAgreement: 0.74,
        lowConsensus: false,
      },
      executionTime: 20,
      modelAgreement: 0.74,
    });

    const chainSpy = vi.spyOn(ModelChainWorkflow, 'executeChain').mockResolvedValue({
      finalResponse: 'final-chain-answer',
      chainResults: [
        {
          model: 'biomistral-7b-instruct',
          role: 'refine',
          output: 'refined',
          tokensUsed: 200,
          confidence: 0.9,
          timeMs: 30,
        },
      ],
      totalTokens: 200,
      executionTime: 30,
    });

    const decision: StrategyDecision = {
      ...baseDecision(),
      ensembleConfig: {
        enabled: true,
        models: ['biomistral-7b-instruct', 'biogpt'],
        votingStrategy: 'weighted',
      },
      modelChain: {
        enabled: true,
        steps: [
          {
            model: 'biomistral-7b-instruct',
            role: 'refine',
          },
        ],
        mergeStrategy: 'last',
      },
    };

    const messages: ChatCompletionMessageParam[] = [{ role: 'user', content: 'question' }];
    const result = await MultiModelOrchestrator.executeWorkflow(decision, messages, 'question');

    expect(result.response).toBe('final-chain-answer');
    // Explicit arithmetic: ensemble votes (110+90=200) + chain (200) = 400
    expect(result.tokensUsed).toBe(400);
    expect(result.workflowMetadata.type).toBe('combined');
    expect(ensembleSpy).toHaveBeenCalledOnce();
    expect(chainSpy).toHaveBeenCalledWith(
      expect.anything(),
      messages,
      expect.objectContaining({ initialResponse: 'ensemble-draft' })
    );
  });

  it('executes chain-only workflow', async () => {
    vi.spyOn(ModelChainWorkflow, 'executeChain').mockResolvedValue({
      finalResponse: 'chain-only',
      chainResults: [],
      totalTokens: 150,
      executionTime: 12,
    });

    const decision: StrategyDecision = {
      ...baseDecision(),
      modelChain: {
        enabled: true,
        steps: [],
        mergeStrategy: 'last',
      },
    };

    const result = await MultiModelOrchestrator.executeWorkflow(decision, [], 'q');

    expect(result.response).toBe('chain-only');
    expect(result.tokensUsed).toBe(150);
    expect(result.workflowMetadata.type).toBe('chain');
  });

  it('executes ensemble-only workflow', async () => {
    vi.spyOn(EnsembleWorkflow, 'executeEnsemble').mockResolvedValue({
      response: 'ensemble-only',
      confidence: 0.8,
      votes: [{ model: 'biogpt', response: 'x', tokensUsed: 77 }],
      voteBreakdown: {
        selectedModel: 'biogpt',
        strategy: 'majority',
        modelAgreement: 1,
        lowConsensus: false,
      },
      executionTime: 10,
      modelAgreement: 1,
    });

    const decision: StrategyDecision = {
      ...baseDecision(),
      ensembleConfig: {
        enabled: true,
        models: ['biogpt'],
        votingStrategy: 'majority',
      },
    };

    const result = await MultiModelOrchestrator.executeWorkflow(decision, [], 'q');

    expect(result.response).toBe('ensemble-only');
    expect(result.tokensUsed).toBe(77);
    expect(result.workflowMetadata.type).toBe('ensemble');
  });

  it('returns empty string from executeWithWorkflow when no workflow is configured', async () => {
    const result = await executeWithWorkflow(baseDecision(), [], 'q');
    expect(result).toBe('');
  });

  it('keeps resource constraints as no-op in workflow-first mode', async () => {
    const decision = baseDecision();

    const unchanged = ResourceConstraints.applyConstraints(decision, {
      availableRAM: 4000,
      availableGPU: false,
      gpuLayers: 0,
      cpuThreads: 4,
      cpuUsage: 80,
      onBattery: false,
      temperature: undefined,
      batteryLevel: undefined,
    });
    expect(unchanged).toBe(decision);

    expect(ResourceConstraints.downgradeForRAM(5000)).toBe('biogpt');
    expect(ResourceConstraints.downgradeForRAM(12000)).toBe('biomistral-7b-instruct');

    const wrapped = await withResourceConstraints(async () => decision, {
      userMessage: 'x',
      conversationHistory: [],
      detectedMode: null,
      detectedDomain: null,
      detectedFileType: 'unknown',
      complexity: 'simple',
      complexityScore: 10,
      confidence: 0.5,
      availableModels: [],
      systemResources: {
        availableRAM: 1,
        availableGPU: false,
        gpuLayers: 0,
        cpuThreads: 1,
        cpuUsage: 0,
        onBattery: false,
      },
      conversationMetadata: {
        id: 'c',
        messageCount: 0,
        totalTokens: 0,
        averageResponseTime: 0,
      },
    });

    expect(wrapped).toBe(decision);
  });
});
