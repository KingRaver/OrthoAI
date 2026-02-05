// app/lib/strategy/implementations/speedStrategy.ts
import { BaseStrategy } from '../baseStrategy';
import { StrategyDecision, StrategyContext } from '../types';
import { StrategyAnalytics } from '../analytics/tracker';

export class SpeedStrategy extends BaseStrategy {
  name = 'speed';
  priority = 90;
  type = 'speed';
  private analytics = new StrategyAnalytics();

  async decide(context: StrategyContext): Promise<StrategyDecision> {
    const fastModel = this.selectModelBySize('3B', context.availableModels.map(m => m.name));

    // Check if user feedback suggests speed isn't enough
    const perf = await this.analytics.getStrategyPerformance('speed');
    const needsMorePower = perf.userSatisfaction < 0.6 && perf.totalDecisions > 5;

    // Adapt: if users consistently unhappy, bump to 7B for critical tasks
    const adaptiveModel = needsMorePower && context.complexityScore > 60
      ? this.selectModelBySize('7B', context.availableModels.map(m => m.name))
      : fastModel;

    const decision: StrategyDecision = {
      id: this.generateId(),
      strategyName: this.name,
      timestamp: new Date(),
      selectedModel: adaptiveModel,
      temperature: 0.2,  // Low for consistency
      maxTokens: needsMorePower ? 5000 : 3000,   // Increase if learning shows need
      streaming: true,
      enableTools: false, // Disable unless critical
      maxToolLoops: 1,
      reasoning: `Speed-first strategy. Using ${adaptiveModel}${needsMorePower ? ' (adapted from feedback - users need more power)' : ''} with minimal tokens. Satisfaction: ${(perf.userSatisfaction * 100).toFixed(0)}%`,
      confidence: 0.9,
      complexityScore: context.complexityScore || 0
    };

    return decision;
  }

  // Learn from feedback - adapt speed/quality trade-off
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

    // Log learning insight
    console.log(`[SpeedStrategy] Feedback recorded: ${feedback} | Decision: ${decisionId}`);
  }
}