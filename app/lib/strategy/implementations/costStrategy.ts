// app/lib/strategy/implementations/costStrategy.ts
import { BaseStrategy } from '../baseStrategy';
import { StrategyDecision, StrategyContext } from '../types';
import { StrategyAnalytics } from '../analytics/tracker';

export class CostStrategy extends BaseStrategy {
  name = 'cost';
  priority = 70;
  type = 'cost';
  private analytics = new StrategyAnalytics();

  async decide(context: StrategyContext): Promise<StrategyDecision> {
    const complexity = context.complexityScore || 0;

    // Learn from feedback - find sweet spot between cost and satisfaction
    const perf = await this.analytics.getStrategyPerformance('cost');

    let model: string;
    let maxTokens = 6000;

    // If users unhappy with cost strategy, gradually allow bigger models for complex tasks
    const satisfactionBonus = perf.userSatisfaction < 0.65 && perf.totalDecisions > 5;

    if (complexity < 40) {
      model = this.selectModelBySize('3B', context.availableModels.map(m => m.name));
      maxTokens = satisfactionBonus ? 7000 : 6000;
    } else if (complexity < 80) {
      model = this.selectModelBySize('7B', context.availableModels.map(m => m.name));
      maxTokens = satisfactionBonus ? 8000 : 6000;
    } else {
      // For high complexity: if satisfaction is very low, allow 16B upgrade
      if (satisfactionBonus && perf.userSatisfaction < 0.5) {
        model = this.selectModelBySize('16B', context.availableModels.map(m => m.name));
        maxTokens = 10000;
      } else {
        // Stay with 7B for cost efficiency
        model = this.selectModelBySize('7B', context.availableModels.map(m => m.name));
        maxTokens = 7000;
      }
    }

    const decision: StrategyDecision = {
      id: this.generateId(),
      strategyName: this.name,
      timestamp: new Date(),
      selectedModel: model,
      temperature: 0.3,
      maxTokens,
      streaming: true,
      enableTools: false,
      maxToolLoops: 2,
      reasoning: `Cost-optimized. Selected ${model} (complexity: ${complexity}). ${satisfactionBonus ? `[Adapted: satisfaction ${(perf.userSatisfaction * 100).toFixed(0)}% - allowing more resources]` : `[Satisfaction: ${(perf.userSatisfaction * 100).toFixed(0)}%]`}`,
      confidence: 0.85,
      complexityScore: complexity
    };

    return decision;
  }

  // Learn from feedback - balance cost vs satisfaction
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

    console.log(`[CostStrategy] Feedback recorded: ${feedback} | Decision: ${decisionId}`);
  }
}