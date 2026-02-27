import { describe, expect, it } from 'vitest';
import { chunkMessage } from '@/app/lib/memory/chunking';

describe('chunkMessage', () => {
  it('splits mixed prose and code while preserving metadata', () => {
    const chunks = chunkMessage(
      {
        id: 'msg_1',
        conversation_id: 'conv_1',
        content: [
          'Patient reports persistent Achilles pain and weakness after sprinting.',
          '',
          'Exam shows reduced plantarflexion strength and tenderness.',
          '',
          '```ts',
          'function assessStrength(score: number) {',
          '  return score < 4 ? "deficit" : "intact";',
          '}',
          '```',
        ].join('\n'),
      },
      { maxChunkTokens: 80 }
    );

    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks.some(chunk => chunk.chunk_kind === 'prose')).toBe(true);
    expect(chunks.some(chunk => chunk.chunk_kind === 'code')).toBe(true);

    const codeChunk = chunks.find(chunk => chunk.chunk_kind === 'code');
    expect(codeChunk?.language).toBe('ts');
    expect(codeChunk?.content).toContain('```ts');

    chunks.forEach((chunk, index) => {
      expect(chunk.id).toBe(`msg_1_chunk_${index}`);
      expect(chunk.chunk_index).toBe(index);
      expect(chunk.parent_message_id).toBe('msg_1');
      expect(chunk.conversation_id).toBe('conv_1');
      expect(chunk.token_estimate).toBeGreaterThan(0);
    });
  });

  it('normalizes code block language tag to lowercase', () => {
    const chunks = chunkMessage({
      id: 'lang_msg',
      conversation_id: 'conv_lang',
      content: '```TS\nconst x: number = 1;\n```',
    });

    const codeChunk = chunks.find(c => c.chunk_kind === 'code');
    expect(codeChunk).toBeDefined();
    expect(codeChunk?.language).toBe('ts');
  });

  it('produces only code chunks for code-only content', () => {
    const chunks = chunkMessage({
      id: 'code_only',
      conversation_id: 'conv_code',
      content: [
        '```python',
        'def assess_strength(score: int) -> str:',
        '    return "deficit" if score < 4 else "intact"',
        '```',
      ].join('\n'),
    });

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.every(c => c.chunk_kind === 'code')).toBe(true);
    expect(chunks.some(c => c.chunk_kind === 'prose')).toBe(false);
    expect(chunks[0].language).toBe('python');
  });

  it('clamps maxChunkTokens to minimum of 80 and still produces valid chunks', () => {
    const chunks = chunkMessage(
      {
        id: 'clamped_msg',
        conversation_id: 'conv_clamped',
        content: 'Short clinical note about patient progress and strength assessment.',
      },
      { maxChunkTokens: 10 } // below minimum; clamped to 80 internally
    );

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.every(c => c.token_estimate > 0)).toBe(true);
    expect(chunks[0].id).toBe('clamped_msg_chunk_0');
  });

  it('returns empty array for empty message content', () => {
    const chunks = chunkMessage({
      id: 'empty',
      conversation_id: 'conv_empty',
      content: '   \n\n\t',
    });

    expect(chunks).toEqual([]);
  });

  it('splits long prose into bounded chunks', () => {
    const longParagraph = Array.from({ length: 280 }, (_, i) => `token${i}`).join(' ');

    const chunks = chunkMessage(
      {
        id: 'long_msg',
        conversation_id: 'conv_long',
        content: longParagraph,
      },
      { maxChunkTokens: 50 }
    );

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every(chunk => chunk.chunk_kind === 'prose')).toBe(true);
    // Token estimation is intentionally approximate; enforce only a loose upper bound.
    expect(chunks.every(chunk => chunk.token_estimate <= 120)).toBe(true);
  });
});
