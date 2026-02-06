// app/lib/strategy/manager.ts
import { StrategyAnalytics } from './analytics/tracker';
import { buildStrategyContext } from './context';
import { BaseStrategy } from './baseStrategy';
import {
  StrategyContext,
  StrategyDecision,
  StrategyType,
  StrategyOutcome,
  PerformanceMetrics
} from './types';
import { WorkflowStrategy } from './implementations/workflowStrategy';

/**
 * Strategy Manager
 * Main orchestrator - registers and executes strategies
 */

export class StrategyManager {
  private strategies: Map<StrategyType, BaseStrategy> = new Map();
  private analytics: StrategyAnalytics;

  constructor() {
    this.analytics = new StrategyAnalytics();
    this.registerStrategies();
  }

  private registerStrategies() {
    this.strategies.set('workflow', new WorkflowStrategy());
  }

  async executeStrategy(
    _strategyType: StrategyType = 'workflow',
    rawContext: Partial<StrategyContext>
  ): Promise<StrategyDecision> {
    try {
      void _strategyType;
      // Build full context
      const context = await buildStrategyContext({
        userMessage: rawContext.userMessage!,
        conversationHistory: rawContext.conversationHistory || [],
        manualModeOverride: rawContext.manualModeOverride,
        manualModelOverride: rawContext.manualModelOverride,
        conversationId: rawContext.conversationId
      });

      // Workflow-first: always use the combined workflow strategy
      const strategy = this.strategies.get('workflow')!;

      // Pre-process
      await strategy.preProcess(context);

      // Execute decision (no throttles or resource gating)
      const decision = await strategy.decide(context);

      // Cap maxTokens to model context window when available
      const selectedModelInfo = context.availableModels.find(m => m.name === decision.selectedModel);
      if (selectedModelInfo?.contextWindow) {
        decision.maxTokens = Math.min(decision.maxTokens, selectedModelInfo.contextWindow);
      }

      // Post-process & log decision (outcome will be logged later via logOutcome)
      await strategy.postProcess(decision);
      await this.analytics.logDecision(decision);

      return decision;
    } catch (error) {
      console.error('[StrategyManager] Error:', error);
      // Graceful fallback - return safe defaults
      return {
        id: 'fallback_' + Date.now(),
        strategyName: 'manual-fallback',
        timestamp: new Date(),
        selectedModel: 'biomistral-7b-instruct',
        temperature: 0.4,
        maxTokens: 8000,
        streaming: true,
        enableTools: false,
        maxToolLoops: 0,
        reasoning: 'Strategy failed - using safe default model',
        confidence: 0.5,
        complexityScore: 50
      };
    }
  }

  async logOutcome(decisionId: string, outcome: StrategyOutcome): Promise<void> {
    await this.analytics.logOutcome(decisionId, outcome);
  }

  getAvailableStrategies(): StrategyType[] {
    return Array.from(this.strategies.keys());
  }

  getStrategyPerformance(strategyType: StrategyType): Promise<PerformanceMetrics> {
    return this.analytics.getStrategyPerformance(strategyType);
  }
}

// Singleton instance
export const strategyManager = new StrategyManager();
