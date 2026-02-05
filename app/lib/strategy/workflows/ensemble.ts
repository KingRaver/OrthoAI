// app/lib/strategy/workflows/ensemble.ts
import { EnsembleConfig } from '../types';
import { getLlmChatUrl } from '@/app/lib/llm/config';

/**
 * Ensemble Workflow
 * Parallel model responses → similarity-based consensus selection
 * Uses fetch directly (like streaming endpoint) to avoid SDK timeout issues
 */

export class EnsembleWorkflow {
  static async executeEnsemble(
    config: EnsembleConfig,
    messages: any[],
    _question: string,
  ): Promise<EnsembleResult> {
    const startTime = Date.now();
    const results = await Promise.allSettled(
      config.models.map(model => this.runModelResponse(model, messages))
    );

    const successfulResults = results
      .filter((r): r is PromiseFulfilledResult<ModelResponse> => r.status === 'fulfilled')
      .map(r => r.value);

    if (successfulResults.length === 0) {
      throw new Error('All ensemble models failed');
    }

    const votingResult = this.calculateConsensus(successfulResults, config);
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
    messages: any[]
  ): Promise<ModelResponse> {
    const body = {
      model,
      messages,
      max_tokens: 3000,
      temperature: 0.3,
      stream: false,
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

    const response = await fetchResponse.json();

    return {
      model,
      tokensUsed: response.usage?.total_tokens || 0,
      response: response.choices[0].message.content?.trim() || ''
    };
  }

  private static calculateConsensus(
    votes: ModelResponse[],
    config: EnsembleConfig
  ): ConsensusResult {
    const weights = config.weights || {};

    // Precompute similarities
    const similarities: number[][] = votes.map(() => votes.map(() => 0));
    for (let i = 0; i < votes.length; i++) {
      for (let j = i + 1; j < votes.length; j++) {
        const sim = this.jaccardSimilarity(votes[i].response, votes[j].response);
        similarities[i][j] = sim;
        similarities[j][i] = sim;
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
