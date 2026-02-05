// app/lib/strategy/implementations/workflowStrategy.ts
import { BaseStrategy } from '../baseStrategy';
import { StrategyAnalytics } from '../analytics/tracker';
import { patternRecognizer } from '@/app/lib/learning/patternRecognition';
import { parameterTuner } from '@/app/lib/learning/parameterTuner';
import {
  StrategyDecision,
  StrategyContext,
  SystemResourceInfo
} from '../types';

/**
 * Workflow Strategy (Multi-Model Orchestration)
 * Supports Chain (sequential refinement) and Ensemble (parallel voting)
 */

export type WorkflowMode = 'chain' | 'ensemble' | 'auto';

export class WorkflowStrategy extends BaseStrategy {
  name = 'workflow';
  priority = 115;
  type = 'workflow';

  private analytics = new StrategyAnalytics();
  private workflowMode: WorkflowMode = 'auto';

  setWorkflowMode(mode: WorkflowMode) {
    this.workflowMode = mode;
  }

  async decide(context: StrategyContext): Promise<StrategyDecision> {
    const complexity = context.complexityScore || 50;
    const mode = context.detectedMode || 'clinical-consult';

    try {
      const themeDetection = await patternRecognizer.detectTheme(context.userMessage);
      console.log(`[Workflow] Theme detected: ${themeDetection.primaryTheme} (confidence: ${themeDetection.confidence.toFixed(2)})`);

      const parameterRec = await parameterTuner.getRecommendation(
        themeDetection.primaryTheme,
        complexity
      );

      const workflowType = this.determineWorkflowType(
        complexity,
        mode,
        themeDetection.primaryTheme,
        context.systemResources,
        this.workflowMode
      );

      const decision = workflowType === 'chain'
        ? this.buildChainWorkflow(complexity, themeDetection, parameterRec, context.systemResources)
        : this.buildEnsembleWorkflow(complexity, themeDetection, parameterRec, context.systemResources);

      console.log(`[Workflow] Selected ${workflowType} workflow (conf: ${decision.confidence.toFixed(2)}) - ${decision.reasoning}`);

      return decision;
    } catch (error) {
      console.warn('[Workflow] ML lookup failed, falling back to chain workflow:', error);
      return this.buildChainWorkflow(complexity, null, null, context.systemResources);
    }
  }

  private determineWorkflowType(
    complexity: number,
    mode: string,
    theme: string,
    resources: SystemResourceInfo,
    userMode: WorkflowMode
  ): 'chain' | 'ensemble' {
    if (userMode === 'chain') return 'chain';
    if (userMode === 'ensemble') {
      if (resources.availableRAM < 6000) {
        console.log('[Workflow] Low RAM for ensemble; falling back to chain');
        return 'chain';
      }
      return 'ensemble';
    }

    const ensembleThemes = ['evidence-brief', 'surgical-planning', 'complications-risk'];
    const useEnsemble = ensembleThemes.some(t => theme.includes(t)) && resources.availableRAM >= 8000;

    const chainThemes = ['clinical-consult', 'surgical-planning', 'complications-risk', 'imaging-dx', 'rehab-rtp', 'evidence-brief'];
    const useChain = chainThemes.some(t => theme.includes(t)) || complexity > 70;

    if (useEnsemble && !useChain) return 'ensemble';
    if (complexity > 80 && resources.availableRAM >= 10000) return 'chain';

    return 'chain';
  }

  private buildChainWorkflow(
    complexity: number,
    themeDetection: any,
    parameterRec: any,
    resources: SystemResourceInfo
  ): StrategyDecision {
    const isConstrained = resources.availableRAM < 6000 || resources.cpuUsage > 90;
    const steps = [] as any[];

    steps.push({
      model: 'biogpt',
      role: 'draft' as const,
      maxTokens: 2000,
      temperature: 0.7,
      systemPromptSuffix: 'Create a fast draft focused on core evidence and claims.'
    });

    if (complexity > 40 || !isConstrained) {
      steps.push({
        model: 'biomistral-7b-instruct',
        role: 'refine' as const,
        maxTokens: 4000,
        temperature: parameterRec?.temperature || 0.4,
        systemPromptSuffix: 'Refine for structure, evidence alignment, and clarity.'
      });
    }

    if (complexity > 70 && !isConstrained) {
      steps.push({
        model: 'biomistral-7b-instruct',
        role: 'review' as const,
        maxTokens: 6000,
        temperature: 0.3,
        systemPromptSuffix: 'Final review for rigor, missing confounders, and limitations.'
      });
    }

    const themeInfo = themeDetection
      ? ` | theme: ${themeDetection.primaryTheme}`
      : '';

    return {
      id: this.generateId(),
      strategyName: this.name,
      timestamp: new Date(),
      selectedModel: steps[0].model,
      temperature: parameterRec?.temperature || 0.4,
      maxTokens: 12000,
      streaming: false,
      enableTools: parameterRec?.enableTools || complexity > 50,
      maxToolLoops: 3,
      modelChain: {
        enabled: true,
        steps,
        mergeStrategy: 'last'
      },
      reasoning: `Chain workflow: ${steps.length} steps (complexity: ${complexity}${themeInfo})`,
      confidence: 0.85,
      complexityScore: complexity,
      metadata: {
        workflowType: 'chain',
        stepCount: steps.length,
        detectedTheme: themeDetection?.primaryTheme,
        themeConfidence: themeDetection?.confidence,
        parameterLearningConfidence: parameterRec?.confidence
      }
    };
  }

  private buildEnsembleWorkflow(
    complexity: number,
    themeDetection: any,
    parameterRec: any,
    resources: SystemResourceInfo
  ): StrategyDecision {
    const models = ['biomistral-7b-instruct', 'biogpt'];
    const weights: Record<string, number> = {
      'biomistral-7b-instruct': 0.7,
      'biogpt': 0.3
    };

    const criticalThemes = ['guideline', 'surgery', 'comparative'];
    const isCritical = criticalThemes.some(t => themeDetection?.primaryTheme?.includes(t));
    const votingStrategy = isCritical ? 'consensus' : 'weighted';
    const minConsensusThreshold = isCritical ? 0.8 : 0.7;

    const themeInfo = themeDetection
      ? ` | theme: ${themeDetection.primaryTheme}`
      : '';

    return {
      id: this.generateId(),
      strategyName: this.name,
      timestamp: new Date(),
      selectedModel: models[0],
      temperature: parameterRec?.temperature || 0.4,
      maxTokens: 8000,
      streaming: false,
      enableTools: false,
      maxToolLoops: 0,
      ensembleConfig: {
        enabled: true,
        models,
        votingStrategy: votingStrategy as any,
        weights,
        minConsensusThreshold
      },
      reasoning: `Ensemble workflow: ${models.length} models, ${votingStrategy} voting (complexity: ${complexity}${themeInfo})`,
      confidence: 0.9,
      complexityScore: complexity,
      metadata: {
        workflowType: 'ensemble',
        modelCount: models.length,
        votingStrategy,
        detectedTheme: themeDetection?.primaryTheme,
        themeConfidence: themeDetection?.confidence,
        parameterLearningConfidence: parameterRec?.confidence
      }
    };
  }

  async updateFromFeedback(
    decisionId: string,
    feedback: 'positive' | 'negative' | 'neutral',
    qualityScore?: number
  ): Promise<void> {
    await this.analytics.logOutcome(decisionId, {
      decisionId,
      responseQuality: qualityScore || (feedback === 'positive' ? 0.9 : feedback === 'negative' ? 0.4 : 0.7),
      userFeedback: feedback,
      responseTime: 0,
      tokensUsed: 0,
      errorOccurred: feedback === 'negative',
      retryCount: 0
    });
  }
}
