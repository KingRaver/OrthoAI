import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as monitor from '@/app/lib/strategy/resources/monitor';
import { ContextDetector } from '@/app/lib/domain/contextDetector';
import { buildStrategyContext, clearDetectionCache } from '@/app/lib/strategy/context';

describe('strategy context builder', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearDetectionCache();
  });

  it('builds strategy context with manual mode override and resource snapshot', async () => {
    vi.spyOn(monitor, 'getSystemResources').mockResolvedValue({
      availableRAM: 16000,
      availableGPU: true,
      gpuLayers: 35,
      cpuThreads: 8,
      cpuUsage: 20,
      onBattery: false,
      temperature: undefined,
      batteryLevel: undefined,
    });

    const context = await buildStrategyContext({
      userMessage: 'Interpret this MRI and suggest rehab progression.',
      conversationHistory: [{ role: 'user', content: 'Hello', tokens: 8 }],
      manualModeOverride: 'rehab-rtp',
      conversationId: 'conv_strategy_1',
    });

    expect(context.detectedMode).toBe('rehab-rtp');
    expect(context.systemResources.availableRAM).toBe(16000);
    expect(context.availableModels.length).toBeGreaterThan(0);
    expect(context.conversationMetadata.messageCount).toBe(1);
    expect(context.conversationMetadata.totalTokens).toBe(8);
  });

  it('reuses cached detection for repeated same conversation/message pairs', async () => {
    vi.spyOn(monitor, 'getSystemResources').mockResolvedValue({
      availableRAM: 12000,
      availableGPU: true,
      gpuLayers: 20,
      cpuThreads: 8,
      cpuUsage: 15,
      onBattery: false,
      temperature: undefined,
      batteryLevel: undefined,
    });

    const detectSpy = vi.spyOn(ContextDetector, 'detect');

    await buildStrategyContext({
      userMessage: 'Need guidance on surgical approach and fixation.',
      conversationHistory: [],
      conversationId: 'conv_cache',
    });

    await buildStrategyContext({
      userMessage: 'Need guidance on surgical approach and fixation.',
      conversationHistory: [],
      conversationId: 'conv_cache',
    });

    expect(detectSpy).toHaveBeenCalledTimes(1);

    clearDetectionCache('conv_cache');

    await buildStrategyContext({
      userMessage: 'Need guidance on surgical approach and fixation.',
      conversationHistory: [],
      conversationId: 'conv_cache',
    });

    expect(detectSpy).toHaveBeenCalledTimes(2);
  });

  it('elevates complexity score for clinically rich anatomy/pathology queries', async () => {
    vi.spyOn(monitor, 'getSystemResources').mockResolvedValue({
      availableRAM: 12000,
      availableGPU: true,
      gpuLayers: 20,
      cpuThreads: 8,
      cpuUsage: 15,
      onBattery: false,
      temperature: undefined,
      batteryLevel: undefined,
    });

    const context = await buildStrategyContext({
      userMessage:
        'Patient with Achilles tendon rupture and weakness asks whether operative reconstruction is best.',
      conversationHistory: [],
      conversationId: 'conv_complexity',
    });

    expect(context.complexityScore).toBeGreaterThanOrEqual(35);
    expect(context.complexityScore).toBeLessThanOrEqual(100);
  });
});
