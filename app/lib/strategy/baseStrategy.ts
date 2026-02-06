// app/lib/strategy/baseStrategy.ts
import { StrategyDecision, StrategyContext, StrategyOutcome } from './types';

/**
 * Base Strategy Class
 * Abstract class for all strategy implementations
 */

export abstract class BaseStrategy {
  abstract name: string;
  abstract priority: number; // Higher = preferred
  abstract type: string; // 'balanced', 'speed', etc.

  // Core decision method
  abstract decide(context: StrategyContext): Promise<StrategyDecision>;

  // Optional hooks
  async preProcess(context: StrategyContext): Promise<void> {
    // Override for pre-processing (caching, validation, etc.)
    void context;
  }

  async postProcess(decision: StrategyDecision): Promise<void> {
    // Override for post-processing (logging, validation, etc.)
    void decision;
  }

  // Analytics integration
  async recordDecision(
    decision: StrategyDecision,
    outcome: StrategyOutcome
  ): Promise<void> {
    // Default implementation - override for custom analytics
    void outcome;
    console.log(`[Strategy:${this.name}] Decision recorded:`, {
      model: decision.selectedModel,
      confidence: decision.confidence,
      complexity: decision.complexityScore
    });
  }

  // Utility methods
  protected calculateComplexityScore(context: StrategyContext): number {
    return context.complexityScore || 50;
  }

  protected isResourceConstrained(context: StrategyContext): boolean {
    const resources = context.systemResources;
    return resources.availableRAM < 8000 || // <8GB
           resources.cpuUsage > 80 ||
           resources.onBattery;
  }

  protected selectModelBySize(
    size: '3B' | '7B' | '16B',
    availableModels: string[]
  ): string {
    const modelMap: Record<string, string> = {
      '3B': 'biogpt',
      '7B': 'biomistral-7b-instruct',
      '16B': 'biomistral-7b-instruct'
    };
    const mapped = modelMap[size];
    return availableModels.find(m => m === mapped) ||
           availableModels[0] || mapped;
  }

  protected generateId(): string {
    return `dec_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }
}
