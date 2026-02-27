import { afterEach, describe, expect, it } from 'vitest';
import { deduplicateAndRerank, extractCodeIdentifiers, mergeConversationAndGlobal } from '@/app/lib/memory/rag/rerank';
import type { RetrievalResult } from '@/app/lib/memory/schemas';

function makeResult(params: {
  id: string;
  similarity: number;
  content: string;
  fts?: number;
  codeIdentifiers?: string[];
}): RetrievalResult {
  return {
    message: {
      id: params.id,
      conversation_id: 'conv_1',
      role: 'assistant',
      content: params.content,
      created_at: new Date().toISOString(),
      code_identifiers: params.codeIdentifiers,
    },
    similarity_score: params.similarity,
    fts_score: params.fts,
  };
}

describe('memory rerank', () => {
  afterEach(() => {
    delete process.env.RAG_RERANK_ALPHA;
    delete process.env.RAG_RERANK_BETA;
    delete process.env.RAG_RERANK_GAMMA;
  });

  it('extracts identifiers from code blocks, inline code, casing, and function calls', () => {
    const input = [
      'Use `renderChart(data)` before updateUI.',
      'We also call parse_json(payload) and handleError(err).',
      '```ts',
      'function fetchPatientData(record_id: string) { return record_id; }',
      '```',
    ].join('\n');

    const identifiers = extractCodeIdentifiers(input);

    expect(identifiers.has('renderchart')).toBe(true);
    expect(identifiers.has('updateui')).toBe(true);
    expect(identifiers.has('parse_json')).toBe(true);
    expect(identifiers.has('handleerror')).toBe(true);
    expect(identifiers.has('fetchpatientdata')).toBe(true);
    expect(identifiers.has('record_id')).toBe(true);
  });

  it('returns empty array when both dense and fts inputs are empty', () => {
    const reranked = deduplicateAndRerank([], [], 'any query');
    expect(reranked).toEqual([]);
  });

  it('handles results with undefined fts_score without throwing', () => {
    process.env.RAG_RERANK_ALPHA = '1';
    process.env.RAG_RERANK_BETA = '0';
    process.env.RAG_RERANK_GAMMA = '0';

    const dense = [
      makeResult({ id: 'no_fts', similarity: 0.75, content: 'Result with no FTS score' }),
    ];

    // fts_score is undefined — should not throw
    expect(() => deduplicateAndRerank(dense, [], 'query')).not.toThrow();
    const reranked = deduplicateAndRerank(dense, [], 'query');
    expect(reranked).toHaveLength(1);
    expect(reranked[0].message.id).toBe('no_fts');
  });

  it('deduplicates by message id and reranks using configured weights', () => {
    process.env.RAG_RERANK_ALPHA = '0';
    process.env.RAG_RERANK_BETA = '0';
    process.env.RAG_RERANK_GAMMA = '1';

    const dense = [
      makeResult({ id: 'a', similarity: 0.95, content: 'General response without matching code' }),
      makeResult({
        id: 'b',
        similarity: 0.2,
        content: 'Try parse_json(payload) to normalize the response.',
        codeIdentifiers: ['parse_json'],
      }),
    ];

    const fts = [
      makeResult({ id: 'a', similarity: 0.4, content: 'Duplicate entry from lexical search', fts: 1.2 }),
    ];

    const reranked = deduplicateAndRerank(dense, fts, 'Need help with parse_json errors');

    expect(reranked).toHaveLength(2);
    expect(reranked[0].message.id).toBe('b');
    expect(reranked[0].similarity_score).toBe(1);
    expect(reranked[1].message.id).toBe('a');
  });

  it('uses only conversation results when enough scoped matches exist', () => {
    process.env.RAG_RERANK_ALPHA = '1';
    process.env.RAG_RERANK_BETA = '0';
    process.env.RAG_RERANK_GAMMA = '0';

    const conversationResults = Array.from({ length: 5 }, (_, i) =>
      makeResult({ id: `conv_${i}`, similarity: 0.2 + i * 0.1, content: `Conversation result ${i}` })
    );
    const globalResults = [makeResult({ id: 'global_1', similarity: 0.99, content: 'Global result' })];

    const merged = mergeConversationAndGlobal(conversationResults, globalResults, 'query');

    expect(merged).toHaveLength(5);
    expect(merged.some(result => result.message.id === 'global_1')).toBe(false);
  });

  it('boosts conversation results when blending with global results', () => {
    process.env.RAG_RERANK_ALPHA = '1';
    process.env.RAG_RERANK_BETA = '0';
    process.env.RAG_RERANK_GAMMA = '0';

    const conversationResults = [
      makeResult({ id: 'conversation_top', similarity: 0.42, content: 'Scoped answer' }),
    ];
    const globalResults = [
      makeResult({ id: 'global_top', similarity: 0.5, content: 'Global answer' }),
    ];

    const merged = mergeConversationAndGlobal(conversationResults, globalResults, 'query');

    expect(merged[0].message.id).toBe('conversation_top');
    expect(merged[0].similarity_score).toBeGreaterThan(0.5);
  });
});
