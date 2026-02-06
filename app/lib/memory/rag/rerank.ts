// app/lib/memory/rag/rerank.ts
// Phase 3: Hybrid Retrieval Reranking Algorithm
// Combines dense (semantic) + FTS (lexical) search results

import { RetrievalResult } from '../schemas';
import { getMemoryConfig } from '../config';

/**
 * Extract code identifiers from text
 * Identifies: code blocks, inline code, camelCase, PascalCase, function calls
 */
export function extractCodeIdentifiers(text: string): Set<string> {
  const identifiers = new Set<string>();

  // Extract from code blocks (```code```)
  const codeBlockRegex = /```[\s\S]*?```/g;
  const codeBlocks = text.match(codeBlockRegex) || [];
  codeBlocks.forEach(block => {
    // Remove backticks and extract words
    const cleanBlock = block.replace(/```/g, '');
    const words = cleanBlock.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g) || [];
    words.forEach(w => identifiers.add(w.toLowerCase()));
  });

  // Extract from inline code (`code`)
  const inlineCodeRegex = /`([^`]+)`/g;
  let match;
  while ((match = inlineCodeRegex.exec(text)) !== null) {
    const code = match[1];
    const words = code.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g) || [];
    words.forEach(w => identifiers.add(w.toLowerCase()));
  }

  // Extract camelCase and PascalCase identifiers
  const camelCaseRegex = /\b[a-z]+[A-Z][a-zA-Z0-9]*\b/g;
  const pascalCaseRegex = /\b[A-Z][a-z]+[A-Z][a-zA-Z0-9]*\b/g;
  const camelMatches = text.match(camelCaseRegex) || [];
  const pascalMatches = text.match(pascalCaseRegex) || [];
  [...camelMatches, ...pascalMatches].forEach(w => identifiers.add(w.toLowerCase()));

  // Extract function calls (word followed by parenthesis)
  const functionCallRegex = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
  while ((match = functionCallRegex.exec(text)) !== null) {
    identifiers.add(match[1].toLowerCase());
  }

  // Extract snake_case and SCREAMING_SNAKE_CASE
  const snakeCaseRegex = /\b[a-z]+_[a-z0-9_]+\b/gi;
  const snakeMatches = text.match(snakeCaseRegex) || [];
  snakeMatches.forEach(w => identifiers.add(w.toLowerCase()));

  return identifiers;
}

/**
 * Calculate code identifier match score
 * Returns 1 if query identifiers are found in result content, 0 otherwise
 */
function calculateCodeMatch(
  queryIdentifiers: Set<string>,
  resultMessage: { content: string; code_identifiers?: string[] }
): number {
  if (queryIdentifiers.size === 0) return 0;

  const resultIdentifiers = resultMessage.code_identifiers && resultMessage.code_identifiers.length > 0
    ? new Set(resultMessage.code_identifiers.map(i => i.toLowerCase()))
    : extractCodeIdentifiers(resultMessage.content);

  // Check if any query identifier is in result
  for (const identifier of queryIdentifiers) {
    if (resultIdentifiers.has(identifier)) {
      return 1; // Binary match (0 or 1)
    }
  }

  return 0;
}

/**
 * Normalize BM25 score to 0-1 range
 * BM25 scores are unbounded; typical range is 0-20
 */
function normalizeBM25(bm25Score: number): number {
  // FTS5 bm25: lower is better. Convert to 0-1 where higher is better.
  return bm25Score <= 0 ? 1 : 1 / (1 + bm25Score);
}

/**
 * Calculate final reranking score
 * Formula: α·dense_sim + β·bm25_norm + γ·code_match
 */
function calculateFinalScore(
  result: RetrievalResult,
  queryIdentifiers: Set<string>,
  alpha: number,
  beta: number,
  gamma: number
): number {
  // Dense similarity (already 0-1)
  const denseSim = result.similarity_score || 0;

  // BM25 score (normalize to 0-1)
  const bm25Norm = result.fts_score ? normalizeBM25(result.fts_score) : 0;

  // Code identifier match (0 or 1)
  const codeMatch = calculateCodeMatch(queryIdentifiers, result.message);

  // Weighted combination
  const finalScore = alpha * denseSim + beta * bm25Norm + gamma * codeMatch;

  return finalScore;
}

/**
 * Deduplicate and rerank hybrid search results
 * Combines dense (semantic) and FTS (lexical) results
 *
 * @param denseResults - Results from Chroma semantic search
 * @param ftsResults - Results from SQLite FTS5 lexical search
 * @param query - Original query text
 * @returns Deduplicated and reranked results
 */
export function deduplicateAndRerank(
  denseResults: RetrievalResult[],
  ftsResults: RetrievalResult[],
  query: string
): RetrievalResult[] {
  const config = getMemoryConfig();

  // Get reranking coefficients from config
  const alpha = config.ragRerankAlpha;
  const beta = config.ragRerankBeta;
  const gamma = config.ragRerankGamma;

  // Extract code identifiers from query
  const queryIdentifiers = extractCodeIdentifiers(query);

  // Deduplicate by message ID
  const seen = new Map<string, RetrievalResult>();

  // Process all results
  for (const result of [...denseResults, ...ftsResults]) {
    const key = result.message.id;

    // Keep the result with higher similarity score if duplicate
    const existing = seen.get(key);
    if (!existing || result.similarity_score > existing.similarity_score) {
      seen.set(key, result);
    }
  }

  // Rerank all unique results
  const merged = Array.from(seen.values());

  const reranked = merged.map(result => ({
    ...result,
    final_score: calculateFinalScore(result, queryIdentifiers, alpha, beta, gamma),
  }));

  // Sort by final score (descending)
  reranked.sort((a, b) => (b.final_score || 0) - (a.final_score || 0));

  // Apply final score as the new similarity score and omit the internal field
  return reranked.map(({ final_score, similarity_score, ...result }) => ({
    ...result,
    similarity_score: final_score ?? similarity_score
  }));
}

/**
 * Merge and rerank conversation-scoped and global results
 * Prioritizes conversation-scoped results when available
 */
export function mergeConversationAndGlobal(
  conversationResults: RetrievalResult[],
  globalResults: RetrievalResult[],
  query: string,
  conversationWeight: number = 0.7
): RetrievalResult[] {
  // If we have enough conversation results, prefer those
  if (conversationResults.length >= 5) {
    return deduplicateAndRerank(conversationResults, [], query);
  }

  // Otherwise, blend conversation and global results
  // Boost conversation result scores
  const boostedConversationResults = conversationResults.map(r => ({
    ...r,
    similarity_score: Math.min(1, r.similarity_score * (1 + conversationWeight)),
  }));

  return deduplicateAndRerank(boostedConversationResults, globalResults, query);
}
