// app/lib/strategy/implementations/adaptiveStrategy.ts
import { BaseStrategy } from '../baseStrategy';
import { StrategyAnalytics } from '../analytics/tracker';
import { patternRecognizer } from '@/app/lib/learning/patternRecognition';
import { parameterTuner } from '@/app/lib/learning/parameterTuner';
import {
  StrategyDecision,
  StrategyContext,
  PerformanceMetrics,
  ModelMetrics,
  SystemResourceInfo
} from '../types';

/**
 * Adaptive Strategy (ML-Driven)
 * Uses historical analytics + user feedback to pick BioMistral vs BioGPT
 */

export class AdaptiveStrategy extends BaseStrategy {
  name = 'adaptive';
  priority = 110;
  type = 'adaptive';

  private analytics = new StrategyAnalytics();

  async decide(context: StrategyContext): Promise<StrategyDecision> {
    const complexity = context.complexityScore || 50;
    const mode = context.detectedMode || 'clinical-consult';

    try {
      const themeDetection = await patternRecognizer.detectTheme(context.userMessage);
      console.log(`[Adaptive] Theme detected: ${themeDetection.primaryTheme} (confidence: ${themeDetection.confidence.toFixed(2)})`);

      const [strategyPerf, modelPerfPrimary, modelPerfFast] = await Promise.all([
        this.analytics.getStrategyPerformance('balanced'),
        this.analytics.getModelPerformance('biomistral-7b-instruct'),
        this.analytics.getModelPerformance('biogpt')
      ]);

      const parameterRec = await parameterTuner.getRecommendation(
        themeDetection.primaryTheme,
        complexity
      );
      console.log(`[Adaptive] Parameter tuning: ${parameterRec.reasoning}`);

      const recommendation = this.calculateOptimalModel(
        complexity,
        mode,
        strategyPerf,
        modelPerfPrimary,
        modelPerfFast,
        context.systemResources,
        themeDetection,
        parameterRec
      );

      const decision: StrategyDecision = {
        id: this.generateId(),
        strategyName: this.name,
        timestamp: new Date(),
        selectedModel: recommendation.model,
        fallbackModels: recommendation.confidence < 0.7 ? [recommendation.alternative] : undefined,
        temperature: recommendation.temperature,
        maxTokens: recommendation.maxTokens,
        streaming: true,
        enableTools: recommendation.enableTools,
        maxToolLoops: 3,
        reasoning: recommendation.reasoning,
        confidence: recommendation.confidence,
        complexityScore: complexity,
        metadata: {
          historicalSuccessRate: modelPerfPrimary.successRate,
          resourceConstrained: this.isResourceConstrained(context),
          detectedTheme: themeDetection.primaryTheme,
          themeConfidence: themeDetection.confidence,
          parameterLearningConfidence: parameterRec.confidence,
          strategyPerfMetrics: {
            avgQuality: strategyPerf.averageQuality,
            totalDecisions: strategyPerf.totalDecisions
          }
        }
      };

      console.log(`[Adaptive] Selected ${decision.selectedModel} (conf: ${decision.confidence.toFixed(2)}) - ${decision.reasoning}`);

      return decision;
    } catch (error) {
      console.warn('[Adaptive] ML lookup failed, falling back to complexity:', error);
      const fallback = new (await import('./complexityStrategy')).ComplexityStrategy();
      return fallback.decide(context);
    }
  }

  private calculateOptimalModel(
    complexity: number,
    mode: string,
    strategyPerf: PerformanceMetrics,
    modelPrimary: ModelMetrics,
    modelFast: ModelMetrics,
    resources: SystemResourceInfo,
    themeDetection?: { primaryTheme: string; confidence: number; suggestedModel: string; suggestedTemperature: number },
    parameterRec?: { temperature: number; maxTokens: number; enableTools: boolean; confidence: number }
  ): {
    model: string;
    alternative: string;
    temperature: number;
    maxTokens: number;
    enableTools: boolean;
    reasoning: string;
    confidence: number;
  } {
    const isConstrained = resources.availableRAM < 8000 || resources.cpuUsage > 75;

    let scorePrimary = modelPrimary.successRate * (1 + Math.min(complexity / 300, 0.4));
    let scoreFast = modelFast.successRate * (1 - Math.min(complexity / 200, 0.3));

    if (themeDetection && themeDetection.confidence > 0.7) {
      const themeBoost = 0.15 * themeDetection.confidence;
      if (themeDetection.suggestedModel.includes('biogpt')) {
        scoreFast += themeBoost;
      } else {
        scorePrimary += themeBoost;
      }
    }

    let model, alternative, confidence, reasoning, temperature;

    if (isConstrained || scoreFast > scorePrimary * 0.95) {
      model = 'biogpt';
      alternative = 'biomistral-7b-instruct';
      confidence = scoreFast;
      reasoning = `BioGPT favored (fast: ${scoreFast.toFixed(2)} vs BioMistral: ${scorePrimary.toFixed(2)})`;
    } else {
      model = 'biomistral-7b-instruct';
      alternative = 'biogpt';
      confidence = scorePrimary;
      reasoning = `BioMistral favored for complexity ${complexity} (score ${scorePrimary.toFixed(2)})`;
    }

    if (parameterRec && parameterRec.confidence > 0.7) {
      temperature = parameterRec.temperature;
    } else if (themeDetection && themeDetection.confidence > 0.7) {
      temperature = themeDetection.suggestedTemperature;
    } else {
      temperature = complexity > 70 ? 0.45 : 0.3;
    }

    const maxTokens = parameterRec && parameterRec.confidence > 0.7
      ? parameterRec.maxTokens
      : (isConstrained ? 5000 : 12000);

    const enableTools = false;

    const themeInfo = themeDetection ? ` | theme: ${themeDetection.primaryTheme}` : '';
    const modeInfo = mode ? ` | mode: ${mode}` : '';
    const strategyInfo = strategyPerf.totalDecisions > 10
      ? ` | strategy quality: ${strategyPerf.averageQuality.toFixed(2)}`
      : '';

    return {
      model,
      alternative,
      temperature,
      maxTokens,
      enableTools,
      reasoning: `${reasoning} | constrained: ${isConstrained}${themeInfo}${modeInfo}${strategyInfo}`,
      confidence: Math.min(0.98, confidence)
    };
  }

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
  }
}
