// app/lib/strategy/implementations/workflowStrategy.ts
import { BaseStrategy } from '../baseStrategy';
import { StrategyAnalytics } from '../analytics/tracker';
import { patternRecognizer } from '@/app/lib/learning/patternRecognition';
import { parameterTuner } from '@/app/lib/learning/parameterTuner';
import { StrategyDecision, StrategyContext } from '../types';

/**
 * Workflow Strategy (Multi-Model Orchestration)
 * Single combined workflow: Ensemble draft → Chain refinement
 */

export class WorkflowStrategy extends BaseStrategy {
  name = 'workflow';
  priority = 115;
  type = 'workflow';

  private analytics = new StrategyAnalytics();

  async decide(context: StrategyContext): Promise<StrategyDecision> {
    const complexity = context.complexityScore || 50;
    const mode = context.detectedMode || 'clinical-consult';

    try {
      const themeDetection = await patternRecognizer.detectTheme(context.userMessage);
      console.log(`[Workflow] Theme detected: ${themeDetection.primaryTheme} (confidence: ${themeDetection.confidence.toFixed(2)})`);

      const parameterRec = await parameterTuner.getRecommendation(
        themeDetection.primaryTheme,
        complexity
      );

      const decision = this.buildCombinedWorkflow(complexity, mode, themeDetection, parameterRec);
      console.log(`[Workflow] Selected combined workflow (conf: ${decision.confidence.toFixed(2)}) - ${decision.reasoning}`);

      return decision;
    } catch (error) {
      console.warn('[Workflow] ML lookup failed, falling back to combined workflow:', error);
      return this.buildCombinedWorkflow(complexity, mode, null, null);
    }
  }

  private buildCombinedWorkflow(
    complexity: number,
    mode: string,
    themeDetection: any,
    parameterRec: any
  ): StrategyDecision {
    const ensembleModels = ['biomistral-7b-instruct', 'biogpt'];
    const weights: Record<string, number> = {
      'biomistral-7b-instruct': 0.7,
      'biogpt': 0.3
    };

    const criticalThemes = ['guideline', 'surgery', 'comparative'];
    const isCritical = criticalThemes.some(t => themeDetection?.primaryTheme?.includes(t));
    const votingStrategy = isCritical ? 'consensus' : 'weighted';
    const minConsensusThreshold = isCritical ? 0.8 : 0.7;

    const chainSteps = [
      {
        model: 'biomistral-7b-instruct',
        role: 'refine' as const,
        maxTokens: 6000,
        temperature: parameterRec?.temperature || 0.4,
        systemPromptSuffix: 'Refine the ensemble draft for structure, evidence alignment, and clarity.'
      },
      {
        model: 'biomistral-7b-instruct',
        role: 'review' as const,
        maxTokens: 7000,
        temperature: 0.3,
        systemPromptSuffix: 'Final review for rigor, missing confounders, and limitations.'
      }
    ];

    const themeInfo = themeDetection
      ? ` | theme: ${themeDetection.primaryTheme}`
      : '';

    return {
      id: this.generateId(),
      strategyName: this.name,
      timestamp: new Date(),
      selectedModel: 'biomistral-7b-instruct',
      temperature: parameterRec?.temperature || 0.4,
      maxTokens: 16000,
      streaming: false,
      enableTools: parameterRec?.enableTools || complexity > 50,
      maxToolLoops: 3,
      ensembleConfig: {
        enabled: true,
        models: ensembleModels,
        votingStrategy: votingStrategy as any,
        weights,
        minConsensusThreshold
      },
      modelChain: {
        enabled: true,
        steps: chainSteps,
        mergeStrategy: 'last'
      },
      reasoning: `Combined workflow: ensemble draft + chain refinement (${chainSteps.length} steps, ${votingStrategy} voting) (complexity: ${complexity}${themeInfo})`,
      confidence: 0.92,
      complexityScore: complexity,
      metadata: {
        workflowType: 'combined',
        modelCount: ensembleModels.length,
        stepCount: chainSteps.length,
        votingStrategy,
        detectedTheme: themeDetection?.primaryTheme,
        themeConfidence: themeDetection?.confidence,
        parameterLearningConfidence: parameterRec?.confidence,
        mode
      }
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
