// app/lib/strategy/resources/constraints.ts
import type { ResourceConfig, SystemResourceInfo, StrategyDecision, StrategyContext } from '../types';

/**
 * Resource-Aware Decision Constraints
 * Applies hard limits and auto-downgrades based on system state
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
    const constrainedDecision = { ...decision };

    // Check for environment variable to disable constraints entirely
    const disableConstraints = process.env.DISABLE_RAM_CONSTRAINTS === 'true';

    // 1. RAM CONSTRAINTS - ONLY intervene at EXTREME OOM risk (< 10% of model requirement)
    // Goal: Push hardware to absolute limits - let system use swap/virtual memory aggressively
    const modelRAMReq = this.getModelRAMRequirement(decision.selectedModel);
    const extremeThreshold = modelRAMReq * 0.1; // Only intervene if < 10% of needed RAM

    if (!disableConstraints && resources.availableRAM < extremeThreshold) {
      // EXTREME: Imminent system crash risk - minimal intervention
      console.warn(`[Constraints] EXTREME RAM: ${Math.round(resources.availableRAM)}MB available, ${modelRAMReq}MB recommended - minimal downgrade`);
      constrainedDecision.selectedModel = this.downgradeForRAM(resources.availableRAM);
      constrainedDecision.reasoning += ` [EXTREME RAM: ${Math.round(resources.availableRAM)}MB]`;
    } else if (resources.availableRAM < modelRAMReq * 0.5) {
      // Just log - system will handle swap, no intervention
      console.log(`[Constraints] Low RAM detected: ${Math.round(resources.availableRAM)}MB available - trusting system to use swap/virtual memory`);
    }

    // 2. GPU LAYERS
    if (config.maxGPULayers && resources.gpuLayers > config.maxGPULayers) {
      constrainedDecision.selectedModel = this.selectLowGPUModel();
      constrainedDecision.reasoning += ` GPU layers limited`;
    }

    // 3. CPU USAGE
    if (resources.cpuUsage > 85) {
      constrainedDecision.maxTokens *= 0.7;
      constrainedDecision.temperature = Math.min(constrainedDecision.temperature, 0.2);
      constrainedDecision.reasoning += ` High CPU (${Math.round(resources.cpuUsage)}%)`;
    }

    // 4. THERMAL THROTTLING
    if (config.thermalThreshold && resources.temperature && resources.temperature > config.thermalThreshold) {
      constrainedDecision.streaming = true;
      constrainedDecision.maxTokens *= 0.5;
      constrainedDecision.reasoning += ` Thermal throttling`;
    }

    // 5. BATTERY MODE
    if (config.batteryAware && resources.onBattery && resources.batteryLevel! < 20) {
      constrainedDecision.selectedModel = 'biogpt';
      constrainedDecision.maxTokens = 2000;
      constrainedDecision.streaming = true;
      constrainedDecision.reasoning += ` Battery saver mode`;
    }

    // 6. RESPONSE TIMEOUT
    if (config.maxResponseTime) {
      // Reduce tokens proportionally
      constrainedDecision.maxTokens = Math.min(
        constrainedDecision.maxTokens,
        Math.floor(config.maxResponseTime / 2)  // Conservative
      );
    }

    return constrainedDecision;
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
    const violations: string[] = [];

    // Only warn about CRITICAL resource issues, don't block execution
    // User is running local models and doesn't want artificial limits

    // Only fail if RAM is EXTREMELY insufficient (< 10% of model requirement)
    // System can handle swap/virtual memory aggressively - trust the hardware
    const modelRAMReq = this.getModelRAMRequirement(decision.selectedModel);
    if (resources.availableRAM < modelRAMReq * 0.1) {
      violations.push(`Extreme RAM shortage: ${Math.round(resources.availableRAM)}MB available, ${modelRAMReq}MB recommended - system may crash`);
    }

    // No token limit checks - let the model and system handle it naturally

    return {
      valid: violations.length === 0,
      violations
    };
  }

  /**
   * Get recommended config for current system
   */
  static getRecommendedConfig(resources: SystemResourceInfo): ResourceConfig {
    // Extremely permissive - let the machine cook!
    const disableConstraints = process.env.DISABLE_RAM_CONSTRAINTS === 'true';

    return {
      maxRAM: disableConstraints ? resources.availableRAM * 3.0 : resources.availableRAM * 0.98,  // 98% or 3x (unlimited)
      maxGPULayers: resources.availableRAM > 16000 ? 35 : 25,
      maxCPUThreads: Math.min(resources.cpuThreads, 8),
      thermalThreshold: 85,  // Conservative
      batteryAware: resources.onBattery,
      maxResponseTime: resources.cpuUsage > 70 ? 30000 : 60000
    };
  }

  private static getModelRAMRequirement(model: string): number {
    const requirements: Record<string, number> = {
      'biogpt': 3000,
      'biomistral-7b': 8000
    };

    for (const [key, ram] of Object.entries(requirements)) {
      if (model.includes(key)) return ram;
    }
    return 8000; // Default
  }

  /**
   * Pre-check context and suggest constraints
   */
  static suggestConstraintsForContext(context: StrategyContext): ResourceConfig {
    const baseConfig = this.getRecommendedConfig(context.systemResources);
    
    // Complexity-based adjustments
    if (context.complexityScore! > 80) {
      baseConfig.maxTokens = 16000;
    } else if (context.complexityScore! < 30) {
      baseConfig.maxTokens = 3000;
    }

    return baseConfig;
  }
}

/**
 * Middleware - Apply to all decisions automatically
 * DISABLED: Trust the user and adaptive strategy to make the right choices
 * System can handle swap/virtual memory - no artificial limits
 */
export function withResourceConstraints(
  decisionFn: (context: StrategyContext) => Promise<StrategyDecision>,
  context: StrategyContext
): Promise<StrategyDecision> {
  return decisionFn(context).then(decision => {
    const constraints = ResourceConstraints.suggestConstraintsForContext(context);

    // Apply only soft constraints (warnings, not hard limits)
    const validation = ResourceConstraints.isValidDecision(decision, context.systemResources, constraints);

    if (!validation.valid) {
      // Just log info - never block execution, system can handle it
      console.log('[Constraints] Resource info (not blocking, system can handle this):', validation.violations);
      console.log('[Constraints] Trusting strategy decision - letting system work at full capacity:', decision.selectedModel);
    }

    // NEVER override the strategy - trust the system and let it push limits
    return decision;
  });
}