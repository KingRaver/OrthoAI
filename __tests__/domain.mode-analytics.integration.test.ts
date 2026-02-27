import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Tests the full quality lifecycle:
//   1. logInteraction with a predicted (mid-range) quality score
//   2. updateFeedback positive → quality overrides to 0.95
//   3. updateFeedback neutral  → quality overrides to 0.7
//   4. getModePerformance aggregates multiple interactions correctly
//   5. getAllModesPerformance includes all tested modes

let originalCwd = process.cwd();
let tempDir = '';
let ModeAnalyticsClass: (new () => {
  logInteraction: (params: {
    id: string;
    mode: string;
    modelUsed: string;
    responseQuality: number;
    responseTime: number;
    tokensUsed: number;
    userFeedback?: 'positive' | 'negative' | 'neutral' | null;
  }) => Promise<void>;
  updateFeedback: (id: string, feedback: 'positive' | 'negative' | 'neutral') => Promise<void>;
  getModePerformance: (mode: string) => Promise<{
    totalInteractions: number;
    averageQuality: number;
    feedbackBreakdown: {
      positive: number;
      negative: number;
      neutral: number;
      total: number;
    };
  }>;
  getAllModesPerformance: () => Promise<Array<{ mode: string }>>;
});

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orthoai-mode-integration-'));
  process.chdir(tempDir);

  const module = await import('@/app/lib/domain/modeAnalytics');
  ModeAnalyticsClass = module.ModeAnalytics;
});

afterAll(() => {
  process.chdir(originalCwd);
  if (tempDir) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('ModeAnalytics quality lifecycle', () => {
  it('positive feedback overrides predicted quality to 0.95', async () => {
    const analytics = new ModeAnalyticsClass();
    const mode = `lifecycle-positive-${Date.now()}`;
    const id = `mode_integration_pos_${Date.now()}`;

    // Simulate computeInitialQuality returning a mid-range predicted score
    await analytics.logInteraction({
      id,
      mode,
      modelUsed: 'biomistral-7b-instruct',
      responseQuality: 0.75,
      responseTime: 300,
      tokensUsed: 600,
    });

    const before = await analytics.getModePerformance(mode);
    expect(before.averageQuality).toBeCloseTo(0.75, 5);
    expect(before.feedbackBreakdown.positive).toBe(0);

    await analytics.updateFeedback(id, 'positive');

    const after = await analytics.getModePerformance(mode);
    expect(after.averageQuality).toBeCloseTo(0.95, 5);
    expect(after.feedbackBreakdown.positive).toBe(1);
    expect(after.feedbackBreakdown.negative).toBe(0);
    expect(after.feedbackBreakdown.neutral).toBe(0);
  });

  it('neutral feedback overrides predicted quality to 0.7', async () => {
    const analytics = new ModeAnalyticsClass();
    const mode = `lifecycle-neutral-${Date.now()}`;
    const id = `mode_integration_neu_${Date.now()}`;

    await analytics.logInteraction({
      id,
      mode,
      modelUsed: 'biomistral-7b-instruct',
      responseQuality: 0.75,
      responseTime: 250,
      tokensUsed: 500,
    });

    await analytics.updateFeedback(id, 'neutral');

    const result = await analytics.getModePerformance(mode);
    expect(result.averageQuality).toBeCloseTo(0.7, 5);
    expect(result.feedbackBreakdown.neutral).toBe(1);
    expect(result.feedbackBreakdown.positive).toBe(0);
    expect(result.feedbackBreakdown.negative).toBe(0);
  });

  it('aggregates multiple interactions for the same mode correctly', async () => {
    const analytics = new ModeAnalyticsClass();
    const mode = `lifecycle-multi-${Date.now()}`;

    const ids = [`mode_m1_${Date.now()}`, `mode_m2_${Date.now() + 1}`, `mode_m3_${Date.now() + 2}`];

    await analytics.logInteraction({ id: ids[0], mode, modelUsed: 'biomistral-7b-instruct', responseQuality: 0.8, responseTime: 200, tokensUsed: 400 });
    await analytics.logInteraction({ id: ids[1], mode, modelUsed: 'meditron-7b', responseQuality: 0.7, responseTime: 180, tokensUsed: 350 });
    await analytics.logInteraction({ id: ids[2], mode, modelUsed: 'biomistral-7b-instruct', responseQuality: 0.9, responseTime: 220, tokensUsed: 450 });

    // Apply feedback to two of three
    await analytics.updateFeedback(ids[0], 'positive'); // quality → 0.95
    await analytics.updateFeedback(ids[1], 'negative'); // quality → 0.3

    const result = await analytics.getModePerformance(mode);
    expect(result.totalInteractions).toBe(3);
    expect(result.feedbackBreakdown.positive).toBe(1);
    expect(result.feedbackBreakdown.negative).toBe(1);
    // Third interaction: no feedback, quality stays 0.9
    // averageQuality = (0.95 + 0.3 + 0.9) / 3 = 0.7167
    expect(result.averageQuality).toBeCloseTo((0.95 + 0.3 + 0.9) / 3, 5);
  });

  it('getAllModesPerformance returns all 8 canonical orthopedic modes', async () => {
    const analytics = new ModeAnalyticsClass();
    const expectedModes = [
      'auto',
      'clinical-consult',
      'treatment-decision',
      'surgical-planning',
      'complications-risk',
      'imaging-dx',
      'rehab-rtp',
      'evidence-brief',
    ];

    const all = await analytics.getAllModesPerformance();
    expect(all).toHaveLength(expectedModes.length);
    const modeNames = all.map(m => m.mode);
    for (const mode of expectedModes) {
      expect(modeNames).toContain(mode);
    }
  });
});
