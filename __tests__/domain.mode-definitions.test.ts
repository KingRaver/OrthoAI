import { describe, expect, it } from 'vitest';
import {
  MODE_DEFINITIONS,
  formatModeInfo,
  getModeDefinition,
  getSuggestions,
  getSystemPrompt,
} from '@/app/lib/domain/modeDefinitions';

const ALL_MODES = [
  'clinical-consult',
  'treatment-decision',
  'surgical-planning',
  'complications-risk',
  'imaging-dx',
  'rehab-rtp',
  'evidence-brief',
] as const;

describe('modeDefinitions', () => {
  it('exposes all supported interaction modes by name', () => {
    expect(Object.keys(MODE_DEFINITIONS)).toHaveLength(7);
    expect(Object.keys(MODE_DEFINITIONS)).toEqual(expect.arrayContaining([...ALL_MODES]));
    expect(MODE_DEFINITIONS['treatment-decision'].name).toBe('Treatment Decision');
  });

  it('returns matching mode definition and system prompt', () => {
    const def = getModeDefinition('surgical-planning');
    const prompt = getSystemPrompt('surgical-planning');

    expect(prompt).toBe(def.systemPrompt);
    expect(def.maxTokensSuggestion).toBeGreaterThanOrEqual(5500);
    expect(def.maxTokensSuggestion).toBeLessThanOrEqual(6500);
  });

  it('all modes have temperature in [0.2, 0.3], tokens in [5500, 6500], and non-trivial prompts', () => {
    for (const mode of ALL_MODES) {
      const def = getModeDefinition(mode);
      expect(def.temperatureSuggestion, `${mode}: temperature out of range`).toBeGreaterThanOrEqual(0.2);
      expect(def.temperatureSuggestion, `${mode}: temperature out of range`).toBeLessThanOrEqual(0.3);
      expect(def.maxTokensSuggestion, `${mode}: maxTokens out of range`).toBeGreaterThanOrEqual(5500);
      expect(def.maxTokensSuggestion, `${mode}: maxTokens out of range`).toBeLessThanOrEqual(6500);
      const prompt = getSystemPrompt(mode);
      expect(prompt.length, `${mode}: system prompt is too short`).toBeGreaterThan(100);
    }
  });

  it('includes treatment-decision in suggestions and formats mode info text', () => {
    const suggestions = getSuggestions();
    const treatment = suggestions.find(s => s.mode === 'treatment-decision');

    expect(treatment).toBeDefined();
    expect(treatment?.keywords).toContain('should I operate');

    const info = formatModeInfo('clinical-consult');
    expect(info).toContain('Clinical Consult');
    expect(info).toContain('Attending-level assessment');
  });
});
