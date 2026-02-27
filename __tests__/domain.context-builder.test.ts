import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContextBuilder, buildContextForLLMCall } from '@/app/lib/domain/contextBuilder';
import { getModeDefinition } from '@/app/lib/domain/modeDefinitions';

describe('ContextBuilder', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.DEBUG_CONTEXT;
  });

  it('applies manual mode override over auto-detection', () => {
    const built = ContextBuilder.build({
      userInput: 'Please read this MRI and CT report.',
      manualModeOverride: 'rehab-rtp',
    });

    expect(built.mode).toBe('rehab-rtp');
    expect(built.modeOverridden).toBe(true);
  });

  it('injects domain knowledge by default when a domain is detected', () => {
    const built = ContextBuilder.build({
      userInput: 'MRI T2 scan findings show edema and tendon pathology.',
    });

    expect(built.domainKnowledgeInjected).toBe(true);
    expect(built.systemPrompt).toContain('DOMAIN CONTEXT:');
  });

  it('can disable domain knowledge injection explicitly', () => {
    const built = ContextBuilder.build({
      userInput: 'MRI T2 scan findings show edema and tendon pathology.',
      includeDomainKnowledge: false,
    });

    expect(built.domainKnowledgeInjected).toBe(false);
    expect(built.systemPrompt).not.toContain('DOMAIN CONTEXT:');
  });

  it('does not inject domain knowledge when no domain is detected', () => {
    // A generic non-clinical input that should produce null domain detection
    const built = ContextBuilder.build({
      userInput: 'Hello, how are you today?',
    });

    expect(built.domainKnowledgeInjected).toBe(false);
    expect(built.systemPrompt).not.toContain('DOMAIN CONTEXT:');
  });

  it('buildForStreaming returns mode-specific generation settings', () => {
    const streaming = ContextBuilder.buildForStreaming({
      userInput: 'Need a guideline summary from systematic reviews.',
      manualModeOverride: 'evidence-brief',
    });

    const mode = getModeDefinition('evidence-brief');
    expect(streaming.mode).toBe('evidence-brief');
    expect(streaming.temperature).toBe(mode.temperatureSuggestion);
    expect(streaming.maxTokens).toBe(mode.maxTokensSuggestion);
  });

  it('formatContextInfo returns string with mode, confidence, and domain fields', () => {
    const built = ContextBuilder.build({
      userInput: 'Operative versus nonoperative ACL reconstruction options.',
    });

    const info = ContextBuilder.formatContextInfo(built);

    expect(typeof info).toBe('string');
    expect(info).toContain('Mode:');
    expect(info).toContain('Confidence:');
    expect(info).toContain('Domain:');
  });

  it('buildContextForLLMCall logs detection details when DEBUG_CONTEXT=true', async () => {
    process.env.DEBUG_CONTEXT = 'true';
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await buildContextForLLMCall(
      'Compare operative versus nonoperative management options for this case.'
    );

    expect(result.systemPrompt.length).toBeGreaterThan(0);
    expect(result.mode).toBeTruthy();
    expect(logSpy).toHaveBeenCalled();
  });
});
