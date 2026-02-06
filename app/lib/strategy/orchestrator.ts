// app/lib/strategy/orchestrator.ts
import { StrategyDecision } from './types';
import { ModelChainWorkflow } from './workflows/chain';
import { EnsembleWorkflow } from './workflows/ensemble';
import type { ChatCompletionMessageParam } from 'openai/resources/chat';

type CombinedWorkflowMetadata = {
  type: 'combined';
  ensemble: {
    confidence: number;
    agreement: number;
    selectedModel: string;
    lowConsensus: boolean;
  };
  chain: {
    steps: number;
    totalTime: number;
  };
};

type ChainWorkflowMetadata = {
  type: 'chain';
  steps: number;
  totalTime: number;
};

type EnsembleWorkflowMetadata = {
  type: 'ensemble';
  confidence: number;
  agreement: number;
  selectedModel: string;
  lowConsensus: boolean;
};

type WorkflowMetadata = CombinedWorkflowMetadata | ChainWorkflowMetadata | EnsembleWorkflowMetadata;

/**
 * Multi-Model Workflow Orchestrator
 * Coordinates chain/ensemble execution
 */

export class MultiModelOrchestrator {
  static async executeWorkflow(
    decision: StrategyDecision,
    messages: ChatCompletionMessageParam[],
    userQuestion: string
  ): Promise<{
    response: string;
    workflowMetadata: WorkflowMetadata;
    tokensUsed: number;
  }> {
    if (decision.modelChain?.enabled && decision.ensembleConfig?.enabled) {
      const ensembleConfig = decision.ensembleConfig;
      const ensembleResult = await EnsembleWorkflow.executeEnsemble(
        ensembleConfig,
        messages,
        userQuestion,
        { maxTokens: decision.maxTokens }
      );

      const chainConfig = decision.modelChain;
      const chainResult = await ModelChainWorkflow.executeChain(chainConfig, messages, {
        maxTotalTokens: decision.maxTokens,
        initialResponse: ensembleResult.response
      });

      return {
        response: chainResult.finalResponse,
        workflowMetadata: {
          type: 'combined',
          ensemble: {
            confidence: ensembleResult.confidence,
            agreement: ensembleResult.modelAgreement,
            selectedModel: ensembleResult.voteBreakdown.selectedModel,
            lowConsensus: ensembleResult.voteBreakdown.lowConsensus
          },
          chain: {
            steps: chainResult.chainResults.length,
            totalTime: chainResult.executionTime
          }
        },
        tokensUsed: chainResult.totalTokens + ensembleResult.votes.reduce((sum, v) => sum + v.tokensUsed, 0)
      };
    }

    if (decision.modelChain?.enabled) {
      const chainConfig = decision.modelChain;
      const chainResult = await ModelChainWorkflow.executeChain(chainConfig, messages, {
        maxTotalTokens: decision.maxTokens
      });
      
      return {
        response: chainResult.finalResponse,
        workflowMetadata: {
          type: 'chain',
          steps: chainResult.chainResults.length,
          totalTime: chainResult.executionTime
        },
        tokensUsed: chainResult.totalTokens
      };
    }

    if (decision.ensembleConfig?.enabled) {
      const ensembleConfig = decision.ensembleConfig;
      const ensembleResult = await EnsembleWorkflow.executeEnsemble(
        ensembleConfig,
        messages,
        userQuestion,
        { maxTokens: decision.maxTokens }
      );

      return {
        response: ensembleResult.response,
        workflowMetadata: {
          type: 'ensemble',
          confidence: ensembleResult.confidence,
          agreement: ensembleResult.modelAgreement,
          selectedModel: ensembleResult.voteBreakdown.selectedModel,
          lowConsensus: ensembleResult.voteBreakdown.lowConsensus
        },
        tokensUsed: ensembleResult.votes.reduce((sum, v) => sum + v.tokensUsed, 0)
      };
    }

    throw new Error('No workflow configured in decision');
  }
}

// Update StrategyManager to use orchestrator
export async function executeWithWorkflow(
  decision: StrategyDecision,
  messages: ChatCompletionMessageParam[],
  question: string
): Promise<string> {
  if (decision.modelChain?.enabled || decision.ensembleConfig?.enabled) {
    const result = await MultiModelOrchestrator.executeWorkflow(decision, messages, question);
    return result.response;
  }
  // Single model fallback (handled by LLM route)
  return '';
}
