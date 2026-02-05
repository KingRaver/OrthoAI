// app/lib/strategy/implementations/complexityStrategy.ts
import { BaseStrategy } from '../baseStrategy';
import { StrategyDecision, StrategyContext } from '../types';
import { StrategyAnalytics } from '../analytics/tracker';

/**
 * Complexity-Based Strategy (MVP)
 * Simple → BioGPT, Moderate → BioMistral 7B, Complex → BioMistral 7B
 * NOW WITH FEEDBACK LEARNING: Adjusts complexity thresholds based on user satisfaction
 */

export class ComplexityStrategy extends BaseStrategy {
  name = 'balanced';
  priority = 100;
  type = 'balanced';
  private analytics = new StrategyAnalytics();

  async decide(context: StrategyContext): Promise<StrategyDecision> {
    const complexityScore = this.calculateComplexityScore(context);
    const isConstrained = this.isResourceConstrained(context);

    // Learn from feedback - adjust thresholds if users consistently unhappy at certain complexity levels
    const perf = await this.analytics.getStrategyPerformance('balanced');

    // Adaptive thresholds: if satisfaction is low, be more aggressive with bigger models
    const simpleThreshold = perf.userSatisfaction < 0.6 ? 20 : 30;  // Lower = use better models sooner
    const complexThreshold = perf.userSatisfaction < 0.6 ? 60 : 70;

    let selectedModel: string;
    let temperature: number;
    let maxTokens: number;
    let reasoning: string;

    // Decision logic with adaptive thresholds
    if (complexityScore < simpleThreshold && !isConstrained) {
      // SIMPLE: Fast model
      selectedModel = this.selectModelBySize('3B', context.availableModels.map(m => m.name));
      temperature = 0.3;
      maxTokens = 4000;
      reasoning = `Simple task (score: ${complexityScore}). Using fast model for speed.`;
    } else if (complexityScore < complexThreshold) {
      // MODERATE: Balanced model
      selectedModel = this.selectModelBySize('7B', context.availableModels.map(m => m.name));
      temperature = 0.4;
      maxTokens = 8000;
      reasoning = `Moderate complexity (score: ${complexityScore}). Using balanced research model.`;
    } else {
      // COMPLEX: Expert model
      selectedModel = this.selectModelBySize('16B', context.availableModels.map(m => m.name));
      temperature = 0.5;
      maxTokens = 16000;
      reasoning = `High complexity (score: ${complexityScore}). Using high-capability research model.`;
    }

    // Resource adjustments
    if (isConstrained) {
      selectedModel = this.selectModelBySize('3B', context.availableModels.map(m => m.name));
      maxTokens = Math.min(maxTokens, 4000);
      reasoning += ' Resource constrained - downgraded to fast model.';
    }

    // Add learning insights
    if (perf.totalDecisions > 5) {
      reasoning += ` [Learning: ${perf.totalDecisions} decisions, ${(perf.userSatisfaction * 100).toFixed(0)}% satisfaction, thresholds: ${simpleThreshold}/${complexThreshold}]`;
    }

    const decision: StrategyDecision = {
      id: this.generateId(),
      strategyName: this.name,
      timestamp: new Date(),
      selectedModel,
      temperature,
      maxTokens,
      streaming: true,
      enableTools: false,
      maxToolLoops: 3,
      reasoning,
      confidence: Math.min(0.95, 0.5 + (complexityScore / 200)),
      complexityScore
    };

    return decision;
  }

  // Learn from feedback - refine complexity thresholds
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

    console.log(`[ComplexityStrategy] Feedback recorded: ${feedback} | Decision: ${decisionId}`);
  }
}