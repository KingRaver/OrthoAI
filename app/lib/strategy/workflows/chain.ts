// app/lib/strategy/workflows/chain.ts
import type { ChatCompletionMessageParam } from 'openai/resources/chat';
import { ModelChainConfig, ModelChainStep } from '../types';
import { getLlmChatUrl } from '@/app/lib/llm/config';

/**
 * Model Chaining Workflow
 * Draft → Refine → Validate/Review pipeline for research answers
 */

export class ModelChainWorkflow {
  static async executeChain(
    config: ModelChainConfig,
    messages: ChatCompletionMessageParam[],
    options: {
      maxTotalTokens?: number;
      timeoutMs?: number;
      mergeStrategy?: 'last' | 'concat' | 'vote';
    } = {}
  ): Promise<{
    finalResponse: string;
    chainResults: ChainStepResult[];
    totalTokens: number;
    executionTime: number;
  }> {
    const startTime = Date.now();
    let totalTokens = 0;
    const chainResults: ChainStepResult[] = [];
    let currentResponse = '';

    console.log(`[Chain] Starting ${config.steps.length}-step chain`);

    for (let i = 0; i < config.steps.length; i++) {
      const step = config.steps[i];
      const stepStart = Date.now();

      try {
        const stepResult = await this.executeChainStep(
          step,
          messages,
          currentResponse,
          i === config.steps.length - 1
        );

        chainResults.push(stepResult);
        currentResponse = stepResult.output;
        totalTokens += stepResult.tokensUsed;

        console.log(`[Chain:${step.role}] ${stepResult.tokensUsed}t | conf: ${stepResult.confidence?.toFixed(2)}`);

      } catch (error: any) {
        console.error(`[Chain:${step.role}] Error:`, error);
        chainResults.push({
          model: step.model,
          role: step.role,
          output: `ERROR in ${step.role} (model: ${step.model}): ${error.message || error}`,
          tokensUsed: 50,
          confidence: 0,
          timeMs: Date.now() - stepStart
        });
      }
    }

    const finalResponse = this.mergeChainResults(chainResults, config.mergeStrategy || 'vote');
    const executionTime = Date.now() - startTime;

    return {
      finalResponse,
      chainResults,
      totalTokens,
      executionTime
    };
  }

  private static async executeChainStep(
    step: ModelChainStep,
    baseMessages: ChatCompletionMessageParam[],
    previousOutput: string,
    isFinalStep: boolean
  ): Promise<ChainStepResult> {
    const stepStart = Date.now();

    const rolePrompts: Record<string, string> = {
      draft: 'DRAFT MODE. Produce a fast, structured answer focused on core evidence and key claims.',
      refine: `REFINE MODE. Improve this draft:\n\n"""${previousOutput}"""\n\nStrengthen structure, evidence alignment, and clarity.`,
      validate: `VALIDATE MODE. Review this draft for unsupported claims, missing evidence, and logical gaps:\n\n"""${previousOutput}"""\n\nList corrections and rate confidence 0-1.`,
      review: `EXPERT REVIEW MODE. Final polish for rigor and completeness:\n\n"""${previousOutput}"""`,
      critique: `CRITIC MODE. Identify weaknesses, confounders, and alternative explanations:\n\n"""${previousOutput}"""`
    };

    const messages: ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: `${rolePrompts[step.role]} ${isFinalStep ? 'This is FINAL OUTPUT — make it publication-ready.' : ''}\nRespond with improved analysis and structured output.`
      },
      ...baseMessages.slice(-8),
      {
        role: 'user',
        content: previousOutput || 'Start from scratch.'
      }
    ];

    const body = {
      model: step.model,
      messages,
      temperature: step.temperature || (isFinalStep ? 0.3 : 0.6),
      top_p: 0.9,
      stream: false,
    };

    const response = await fetch(getLlmChatUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Connection': 'keep-alive'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LLM server error: ${response.status} - ${error}`);
    }

    const completion = await response.json();

    const output = completion.choices[0].message.content?.trim() || '';
    const tokensUsed = completion.usage?.total_tokens || output.length / 4;

    const confMatch = output.match(/confidence[:\s]*([0-9.]+)/i);
    const confidence = confMatch ? parseFloat(confMatch[1]) : 0.7;

    return {
      model: step.model,
      role: step.role,
      output,
      tokensUsed,
      confidence,
      timeMs: Date.now() - stepStart
    };
  }

  private static mergeChainResults(
    results: ChainStepResult[],
    strategy: 'last' | 'concat' | 'vote'
  ): string {
    switch (strategy) {
      case 'last':
        return results[results.length - 1].output;
      case 'concat':
        return results.map(r => `\n\n${r.role.toUpperCase()}:\n${r.output}`).join('');
      case 'vote':
      default:
        const final = results[results.length - 1].output;
        const insights = results.slice(0, -1)
          .filter(r => (r.confidence || 0) > 0.6)
          .map(r => `(${r.role}): ${r.output.slice(0, 120)}...`)
          .join('\n');
        return insights ? `${insights}\n\n${'='.repeat(60)}\n\nFINAL:\n${final}` : final;
    }
  }
}

export interface ChainStepResult {
  model: string;
  role: string;
  output: string;
  tokensUsed: number;
  confidence?: number;
  timeMs: number;
}
