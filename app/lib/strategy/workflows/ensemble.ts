// app/lib/strategy/workflows/ensemble.ts
import { EnsembleConfig } from '../types';
import type { ChatCompletionMessageParam } from 'openai/resources/chat';
import { getLlmChatUrl } from '@/app/lib/llm/config';
import { getSharedEmbeddings } from '@/app/lib/memory/rag/embeddings';

type LlmChatRequest = {
  model: string;
  messages: ChatCompletionMessageParam[];
  temperature: number;
  stream: boolean;
  max_tokens?: number;
};

type LlmChatResponse = {
  choices: Array<{ message?: { content?: string | null } | null }>;
  usage?: { total_tokens?: number | null } | null;
};

/**
 * Ensemble Workflow
 * Parallel model responses → similarity-based consensus selection
 * Uses fetch directly (like streaming endpoint) to avoid SDK timeout issues
 */

export class EnsembleWorkflow {
  static async executeEnsemble(
    config: EnsembleConfig,
    messages: ChatCompletionMessageParam[],
    _question: string,
    options: { maxTokens?: number } = {},
  ): Promise<EnsembleResult> {
    const startTime = Date.now();
    const results = await Promise.allSettled(
      config.models.map(model => this.runModelResponse(model, messages, options.maxTokens))
    );

    const successfulResults = results
      .filter((r): r is PromiseFulfilledResult<ModelResponse> => r.status === 'fulfilled')
      .map(r => r.value);

    if (successfulResults.length === 0) {
      throw new Error('All ensemble models failed');
    }

    const votingResult = await this.calculateConsensus(successfulResults, config);
    const executionTime = Date.now() - startTime;

    const consensusThreshold = config.minConsensusThreshold || 0.7;
    const lowConsensus = votingResult.modelAgreement < consensusThreshold;

    return {
      response: votingResult.response,
      confidence: votingResult.confidence,
      votes: successfulResults,
      voteBreakdown: {
        selectedModel: votingResult.selectedModel,
        strategy: config.votingStrategy,
        modelAgreement: votingResult.modelAgreement,
        lowConsensus
      },
      executionTime,
      modelAgreement: votingResult.modelAgreement
    };
  }

  private static async runModelResponse(
    model: string,
    messages: ChatCompletionMessageParam[],
    maxTokens?: number
  ): Promise<ModelResponse> {
    // Enhance messages: add instruction to system, request comprehensive output from user
    const enhancedMessages = messages.map((msg, idx) => {
      // Add anti-echo instruction to system message
      if (msg.role === 'system' && typeof msg.content === 'string') {
        return {
          ...msg,
          content: msg.content + '\n\nIMPORTANT: Do NOT repeat or echo these instructions. Respond directly to the user query with clinical content only.'
        };
      }
      // Request comprehensive output in user message
      if (idx === messages.length - 1 && msg.role === 'user' && typeof msg.content === 'string') {
        return {
          ...msg,
          content: msg.content + '\n\nProvide a comprehensive, detailed clinical response. Do not truncate or abbreviate.'
        };
      }
      return msg;
    });

    // Ensure minimum 4000 tokens to avoid truncation
    const effectiveMaxTokens = Math.max(4000, maxTokens || 8000);

    const body: LlmChatRequest = {
      model,
      messages: enhancedMessages,
      temperature: 0.3,
      stream: false,
      max_tokens: effectiveMaxTokens,
    };

    // Undici is configured globally in instrumentation.ts with no timeouts
    const fetchResponse = await fetch(getLlmChatUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Connection': 'keep-alive'
      },
      body: JSON.stringify(body)
    });

    if (!fetchResponse.ok) {
      const error = await fetchResponse.text();
      throw new Error(`LLM server error: ${fetchResponse.status} - ${error}`);
    }

    const response = (await fetchResponse.json()) as LlmChatResponse;

    return {
      model,
      tokensUsed: response.usage?.total_tokens ?? 0,
      response: response.choices?.[0]?.message?.content?.trim() || ''
    };
  }

  private static async calculateConsensus(
    votes: ModelResponse[],
    config: EnsembleConfig
  ): Promise<ConsensusResult> {
    const weights = config.weights || {};

    const similarities: number[][] = votes.map(() => votes.map(() => 0));
    try {
      const embeddings = getSharedEmbeddings();
      const vectors = await Promise.all(votes.map(vote => embeddings.embed(vote.response)));

      for (let i = 0; i < votes.length; i++) {
        for (let j = i + 1; j < votes.length; j++) {
          const sim = this.cosineSimilarity(vectors[i], vectors[j]);
          similarities[i][j] = sim;
          similarities[j][i] = sim;
        }
      }
    } catch (error) {
      void error;
      // Fallback to lexical similarity if embeddings are unavailable
      for (let i = 0; i < votes.length; i++) {
        for (let j = i + 1; j < votes.length; j++) {
          const sim = this.jaccardSimilarity(votes[i].response, votes[j].response);
          similarities[i][j] = sim;
          similarities[j][i] = sim;
        }
      }
    }

    const avgSimilarity = votes.map((_, i) => {
      if (votes.length <= 1) return 1;
      const total = similarities[i].reduce((sum, val, idx) => idx === i ? sum : sum + val, 0);
      return total / (votes.length - 1);
    });

    const modelAgreement = votes.length <= 1
      ? 1
      : (avgSimilarity.reduce((sum, v) => sum + v, 0) / avgSimilarity.length);

    // Score per strategy
    const scored = votes.map((vote, i) => {
      const weight = weights[vote.model] || 1.0;
      let score = avgSimilarity[i];
      if (config.votingStrategy === 'weighted' || config.votingStrategy === 'consensus') {
        score = avgSimilarity[i] * weight;
      } else if (config.votingStrategy === 'best-of') {
        score = weight;
      }
      return { index: i, model: vote.model, score };
    });

    // Majority strategy: pick most similar response
    if (config.votingStrategy === 'majority') {
      scored.forEach(s => { s.score = avgSimilarity[s.index]; });
    }

    const winner = scored.reduce((best, cur) => cur.score > best.score ? cur : best, scored[0]);

    return {
      response: votes[winner.index].response,
      confidence: Math.min(1, avgSimilarity[winner.index]),
      modelAgreement,
      selectedModel: winner.model
    };
  }

  private static tokenize(text: string): Set<string> {
    return new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(t => t.length > 3)
    );
  }

  private static jaccardSimilarity(a: string, b: string): number {
    const aSet = this.tokenize(a);
    const bSet = this.tokenize(b);
    if (aSet.size === 0 && bSet.size === 0) return 1;
    const intersection = new Set([...aSet].filter(x => bSet.has(x)));
    const unionSize = new Set([...aSet, ...bSet]).size;
    return unionSize === 0 ? 0 : intersection.size / unionSize;
  }

  private static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;
    let dot = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
    }
    return Math.max(0, Math.min(1, dot));
  }
}

export interface ModelResponse {
  model: string;
  response: string;
  tokensUsed: number;
}

export interface ConsensusResult {
  response: string;
  confidence: number;
  modelAgreement: number;
  selectedModel: string;
}

export interface EnsembleResult {
  response: string;
  confidence: number;
  votes: ModelResponse[];
  voteBreakdown: {
    selectedModel: string;
    strategy?: string;
    modelAgreement: number;
    lowConsensus: boolean;
  };
  executionTime: number;
  modelAgreement: number;
}
