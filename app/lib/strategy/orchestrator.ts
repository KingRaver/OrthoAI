// app/lib/strategy/orchestrator.ts
import { StrategyDecision } from './types';
import { ModelChainWorkflow } from './workflows/chain';
import { EnsembleWorkflow } from './workflows/ensemble';
import type { ChatCompletionMessageParam } from 'openai/resources/chat';

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
    workflowMetadata: any;
    tokensUsed: number;
  }> {
    if (decision.modelChain?.enabled) {
      const chainConfig = decision.modelChain;
      const chainResult = await ModelChainWorkflow.executeChain(chainConfig, messages);
      
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
        userQuestion
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
