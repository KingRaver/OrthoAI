// app/lib/strategy/implementations/qualityStrategy.ts
import { BaseStrategy } from '../baseStrategy';
import { StrategyDecision, StrategyContext } from '../types';
import { StrategyAnalytics } from '../analytics/tracker';

export class QualityStrategy extends BaseStrategy {
  name = 'quality';
  priority = 80;
  type = 'quality';
  private analytics = new StrategyAnalytics();

  async decide(context: StrategyContext): Promise<StrategyDecision> {
    const expertModel = this.selectModelBySize('16B', context.availableModels.map(m => m.name));

    // Learn from feedback - tune temperature for optimal quality
    const perf = await this.analytics.getStrategyPerformance('quality');

    // If getting negative feedback, adjust temperature down for more focused responses
    const adaptiveTemperature = perf.userSatisfaction < 0.7 && perf.totalDecisions > 5
      ? 0.4  // More focused
      : perf.userSatisfaction > 0.85
        ? 0.6  // Keep creative if working well
        : 0.5; // Middle ground

    const decision: StrategyDecision = {
      id: this.generateId(),
      strategyName: this.name,
      timestamp: new Date(),
      selectedModel: expertModel,
      temperature: adaptiveTemperature,
      maxTokens: 20000,
      topP: 0.9,
      streaming: true,
      enableTools: false,
      maxToolLoops: 5,
      reasoning: `Quality-first strategy. Using best model (${expertModel}) with full capabilities. Temperature tuned to ${adaptiveTemperature} based on ${perf.totalDecisions} interactions (satisfaction: ${(perf.userSatisfaction * 100).toFixed(0)}%)`,
      confidence: 0.95,
      complexityScore: context.complexityScore || 0
    };

    return decision;
  }

  // Learn from feedback - optimize quality parameters
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

    console.log(`[QualityStrategy] Feedback recorded: ${feedback} | Decision: ${decisionId}`);
  }
}