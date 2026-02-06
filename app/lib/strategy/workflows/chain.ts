// app/lib/strategy/workflows/chain.ts
import type { ChatCompletionMessageParam } from 'openai/resources/chat';
import { ModelChainConfig, ModelChainStep } from '../types';
import { getLlmChatUrl } from '@/app/lib/llm/config';

type LlmChatRequest = {
  model: string;
  messages: ChatCompletionMessageParam[];
  temperature: number;
  top_p: number;
  stream: boolean;
  max_tokens?: number;
};

type LlmChatResponse = {
  choices: Array<{ message?: { content?: string | null } | null }>;
  usage?: { total_tokens?: number | null } | null;
};

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
      initialResponse?: string;
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
    let currentResponse = options.initialResponse || '';

    console.log(`[Chain] Starting ${config.steps.length}-step chain`);

    for (let i = 0; i < config.steps.length; i++) {
      const step = config.steps[i];
      const stepStart = Date.now();

      try {
        const stepMaxTokens = typeof options.maxTotalTokens === 'number'
          ? Math.min(step.maxTokens ?? options.maxTotalTokens, options.maxTotalTokens)
          : step.maxTokens;

        const stepResult = await this.executeChainStep(
          step,
          messages,
          currentResponse,
          i === config.steps.length - 1,
          stepMaxTokens
        );

        chainResults.push(stepResult);
        currentResponse = stepResult.output;
        totalTokens += stepResult.tokensUsed;

        console.log(`[Chain:${step.role}] ${stepResult.tokensUsed}t | conf: ${stepResult.confidence?.toFixed(2)}`);

      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[Chain:${step.role}] Error:`, error);
        chainResults.push({
          model: step.model,
          role: step.role,
          output: `ERROR in ${step.role} (model: ${step.model}): ${errorMessage}`,
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
    isFinalStep: boolean,
    maxTokens?: number
  ): Promise<ChainStepResult> {
    const stepStart = Date.now();

    const rolePrompts: Record<string, string> = {
      draft: 'DRAFT MODE. Produce a comprehensive, structured answer covering all key aspects of the topic. Include core evidence, key claims, differentials, and practical clinical details. Do NOT truncate or abbreviate - provide a complete response.',
      refine: 'REFINE MODE. Improve and EXPAND the draft below. Strengthen structure, evidence alignment, clarity, and completeness. Ensure the response is thorough and addresses all relevant clinical considerations. Do NOT shorten the response.',
      validate: 'VALIDATE MODE. Review the draft below for unsupported claims, missing evidence, and logical gaps. List corrections and rate confidence 0-1. Preserve all valid content.',
      review: 'EXPERT REVIEW MODE. Final polish for rigor and completeness. Ensure the response is comprehensive and clinically thorough. Do NOT truncate - maintain or expand detail.',
      critique: 'CRITIC MODE. Identify weaknesses, confounders, and alternative explanations while preserving the core content.'
    };

    const stepSuffix = step.systemPromptSuffix ? ` ${step.systemPromptSuffix}` : '';
    const baseSystem = baseMessages.find(m => m.role === 'system');
    const baseSystemText = typeof baseSystem?.content === 'string' ? baseSystem.content : '';
    const conversationContext = baseMessages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-8)
      .map(m => {
        const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
        return `${m.role.toUpperCase()}: ${content}`;
      })
      .join('\n');

    const draftBlock = previousOutput
      ? `Draft to improve:\n\n"""${previousOutput}"""`
      : 'No draft provided. Start from scratch.';

    // Build proper system message for the chain step
    const systemContent = [
      baseSystemText,
      rolePrompts[step.role],
      stepSuffix,
      isFinalStep ? 'This is FINAL OUTPUT — make it publication-ready and comprehensive.' : '',
      'Provide thorough clinical analysis. Do NOT echo these instructions.'
    ].filter(Boolean).join('\n\n');

    // Build user message with context and draft
    const userContent = [
      conversationContext ? `Previous conversation:\n${conversationContext}` : '',
      step.role === 'draft' && !previousOutput ? 'Please provide a comprehensive clinical response.' : draftBlock,
    ].filter(Boolean).join('\n\n');

    const messages: ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: systemContent
      },
      {
        role: 'user',
        content: userContent || 'Please provide your clinical analysis.'
      }
    ];

    const body: LlmChatRequest = {
      model: step.model,
      messages,
      temperature: step.temperature || (isFinalStep ? 0.3 : 0.6),
      top_p: 0.9,
      stream: false,
    };
    if (typeof maxTokens === 'number') {
      body.max_tokens = maxTokens;
    }

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

    const completion = (await response.json()) as LlmChatResponse;

    const output = completion.choices?.[0]?.message?.content?.trim() || '';
    const tokensUsed = completion.usage?.total_tokens ?? output.length / 4;

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
