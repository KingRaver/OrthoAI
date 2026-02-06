// app/lib/strategy/resources/constraints.ts
import type { ResourceConfig, SystemResourceInfo, StrategyDecision, StrategyContext } from '../types';

/**
 * Resource Constraints (Disabled)
 * Workflow-first system does not apply throttles or downgrades.
 */

export class ResourceConstraints {
  /**
   * Apply resource limits to strategy decision
   */
  static applyConstraints(
    decision: StrategyDecision,
    resources: SystemResourceInfo,
    config: ResourceConfig = {}
  ): StrategyDecision {
    void resources;
    void config;
    return decision;
  }

  /**
   * Select model based on available RAM
   */
  static downgradeForRAM(availableRAM: number): string {
    if (availableRAM < 6000) return 'biogpt';      // lightweight
    return 'biomistral-7b-instruct';
  }

  static selectLowGPUModel(): string {
    return 'biogpt'; // CPU-friendly
  }

  /**
   * Validate if decision respects constraints
   */
  static isValidDecision(
    decision: StrategyDecision,
    resources: SystemResourceInfo,
    _config?: ResourceConfig
  ): { valid: boolean; violations: string[] } {
    void resources;
    const config = _config ?? {};
    const hasConfig = Object.keys(config).length > 0;
    if (hasConfig) {
      // Constraints are intentionally disabled in workflow-first mode.
    }
    void this.getModelRAMRequirement(decision.selectedModel);
    return {
      valid: true,
      violations: []
    };
  }

  /**
   * Get recommended config for current system
   */
  static getRecommendedConfig(resources: SystemResourceInfo): ResourceConfig {
    void resources;
    return {};
  }

  private static getModelRAMRequirement(model: string): number {
    void model;
    return 0;
  }

  /**
   * Pre-check context and suggest constraints
   */
  static suggestConstraintsForContext(context: StrategyContext): ResourceConfig {
    void context;
    return {};
  }
}

/**
 * Middleware - Apply to all decisions automatically
 * Disabled: no throttles or downgrades in workflow-first mode.
 */
export function withResourceConstraints(
  decisionFn: (context: StrategyContext) => Promise<StrategyDecision>,
  context: StrategyContext
): Promise<StrategyDecision> {
  void context;
  return decisionFn(context);
}
