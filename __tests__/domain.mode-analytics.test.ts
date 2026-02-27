import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

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
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orthoai-mode-analytics-'));
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

describe('ModeAnalytics', () => {
  it('inserts mode rows and includes treatment-decision in aggregate mode list', async () => {
    const analytics = new ModeAnalyticsClass();
    const before = await analytics.getModePerformance('treatment-decision');

    await analytics.logInteraction({
      id: `mode_test_insert_${Date.now()}`,
      mode: 'treatment-decision',
      modelUsed: 'biomistral-7b-instruct',
      responseQuality: 0.8,
      responseTime: 220,
      tokensUsed: 450,
    });

    const after = await analytics.getModePerformance('treatment-decision');
    expect(after.totalInteractions).toBe(before.totalInteractions + 1);

    const allModes = await analytics.getAllModesPerformance();
    expect(allModes.some(mode => mode.mode === 'treatment-decision')).toBe(true);
  });

  it('updates feedback for an existing mode interaction row', async () => {
    const analytics = new ModeAnalyticsClass();
    const mode = `mode-feedback-${Date.now()}`;
    const interactionId = `mode_test_feedback_${Date.now()}`;

    await analytics.logInteraction({
      id: interactionId,
      mode,
      modelUsed: 'biomistral-7b-instruct',
      responseQuality: 0.8,
      responseTime: 180,
      tokensUsed: 320,
    });

    await analytics.updateFeedback(interactionId, 'negative');

    const performance = await analytics.getModePerformance(mode);
    expect(performance.totalInteractions).toBe(1);
    expect(performance.feedbackBreakdown.negative).toBe(1);
    expect(performance.feedbackBreakdown.positive).toBe(0);
    expect(performance.averageQuality).toBeCloseTo(0.3, 5);
  });
});
