// lib/dl-codegen/preprocess.ts
// Advanced code preprocessing: tokenization, feature extraction, embedding integration
import { getSharedEmbeddings } from '../memory/rag/embeddings';
import type { CodeDataset } from './types';
import fs from 'fs/promises';

export async function preprocessCodeData(input: string | CodeDataset): Promise<Float32Array[]> {
  // Use shared embeddings instance to share cache with Memory system
  const ollama = getSharedEmbeddings();

  let texts: string[];

  // Handle different input types
  if (typeof input === 'string') {
    // If it's a file path, read the file
    if (input.endsWith('.json')) {
      const fileContent = await fs.readFile(input, 'utf-8');
      const dataset: CodeDataset = JSON.parse(fileContent);
      texts = dataset.inputs;
    } else {
      // Single text input
      texts = [input];
    }
  } else {
    // CodeDataset object
    texts = input.inputs;
  }

  const features: Float32Array[] = [];

  for (const text of texts) {
    // 1. Simple tokenization (no external library needed)
    const tokens = simpleTokenize(text);
    const keywords = extractKeywords(tokens);
    const astFeatures = parseASTFeatures(text);

    // 2. Ollama embeddings for semantic features (768-dim for nomic-embed-text)
    const embedding = await ollama.embed(text);

    // 3. Numerical vector: [embedding (768) + keywords (100) + AST (50) + syntax stats (10)]
    // Total: 928 dimensions, but we'll truncate embedding to 384 for manageable model size
    const vector = new Float32Array(544); // 384 + 100 + 50 + 10
    vector.set(embedding.slice(0, 384), 0); // Use first 384 dims of 768-dim embedding
    vector.set(keywords, 384);
    vector.set(astFeatures, 384 + 100);
    vector.set(getSyntaxStats(text), 384 + 100 + 50);

    features.push(vector);
  }

  return features;
}

function simpleTokenize(text: string): string[] {
  // Simple word boundary tokenization
  return text.toLowerCase().match(/\b\w+\b/g) || [];
}

function extractKeywords(tokens: string[]): Float32Array {
  // Simple TF-IDF approximation using token frequency
  const vector = new Float32Array(100).fill(0);
  const freq = new Map<string, number>();

  // Count frequencies
  for (const token of tokens) {
    freq.set(token, (freq.get(token) || 0) + 1);
  }

  // Convert to feature vector (top 100)
  const entries = Array.from(freq.entries()).sort((a, b) => b[1] - a[1]);
  entries.slice(0, 100).forEach(([_, count], i) => {
    vector[i] = count / tokens.length; // Normalized frequency
  });

  return vector;
}

function parseASTFeatures(code: string): Float32Array {
  // Simplified AST: function/class counts, nesting depth, etc.
  const features = new Float32Array(50).fill(0);

  features[0] = (code.match(/function\s+\w+|const\s+\w+\s*=/g) || []).length / 10;
  features[1] = (code.match(/class\s+\w+/g) || []).length / 10;
  features[2] = (code.match(/def\s+\w+/g) || []).length / 10;
  features[3] = (code.match(/\{/g) || []).length / 20; // Nesting approximation
  features[4] = (code.match(/import|from/g) || []).length / 10;

  return features;
}

function getSyntaxStats(code: string): Float32Array {
  return new Float32Array([
    code.length / 10000, // Normalized length
    (code.match(/import|from/g) || []).length / 10,
    (code.match(/async|await/g) || []).length / 5,
    (code.match(/if|else/g) || []).length / 10,
    (code.match(/for|while/g) || []).length / 10,
    (code.match(/return/g) || []).length / 10,
    (code.match(/\(/g) || []).length / 20, // Function calls
    (code.match(/=/g) || []).length / 20, // Assignments
    (code.match(/\./g) || []).length / 20, // Property access
    (code.match(/\[/g) || []).length / 10, // Array access
  ]);
}
