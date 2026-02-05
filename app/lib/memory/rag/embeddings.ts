// app/lib/memory/rag/embeddings.ts
// OpenAI-compatible embeddings (llama.cpp server)

import { EmbeddingRequest, EmbeddingResponse } from '../schemas';
import { createHash } from 'crypto';
import { getEmbeddingModel, getEmbeddingUrl } from '@/app/lib/llm/config';

/**
 * Local Embeddings Manager
 * Uses OpenAI-compatible /v1/embeddings endpoint (llama.cpp server)
 */
export class LocalEmbeddings {
  private embeddingModel: string;
  private cache: Map<string, number[]> = new Map();
  private maxCacheSize: number;

  constructor(
    embeddingModel: string = getEmbeddingModel(),
    maxCacheSize: number = 1000
  ) {
    this.embeddingModel = embeddingModel;
    this.maxCacheSize = maxCacheSize;
  }

  /**
   * Embed a single text string
   */
  async embed(text: string): Promise<number[]> {
    const cacheKey = this.getCacheKey(text);
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      this.cache.delete(cacheKey);
      this.cache.set(cacheKey, cached);
      return cached;
    }

    try {
      const payload: EmbeddingRequest = {
        model: this.embeddingModel,
        input: text,
      };

      const response = await fetch(getEmbeddingUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Embedding failed: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as EmbeddingResponse;
      const embedding = data.data?.[0]?.embedding;
      if (!embedding) {
        throw new Error('No embeddings returned');
      }

      const normalized = this.normalize(embedding);
      this.addToCache(cacheKey, normalized);
      return normalized;
    } catch (error) {
      console.error('[LocalEmbeddings] Error embedding text:', error);
      throw error;
    }
  }

  /**
   * Embed multiple texts at once
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    try {
      const payload: EmbeddingRequest = {
        model: this.embeddingModel,
        input: texts,
      };

      const response = await fetch(getEmbeddingUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Embedding batch failed: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as EmbeddingResponse;
      if (!data.data) {
        throw new Error('No embeddings returned');
      }

      const normalized = data.data.map((item, idx) => {
        const norm = this.normalize(item.embedding);
        const cacheKey = this.getCacheKey(texts[idx]);
        this.addToCache(cacheKey, norm);
        return norm;
      });

      return normalized;
    } catch (error) {
      console.error('[LocalEmbeddings] Error embedding batch:', error);
      throw error;
    }
  }

  /**
   * Check if the embedding model is available (best effort)
   */
  async checkModelAvailability(): Promise<boolean> {
    try {
      const base = getEmbeddingUrl().replace(/\/embeddings$/, '');
      const response = await fetch(`${base}/models`);
      if (!response.ok) return false;

      const data = (await response.json()) as { data?: Array<{ id: string }> };
      if (!data.data) return true; // If not provided, assume available
      return data.data.some(m => m.id === this.embeddingModel);
    } catch (error) {
      console.warn('[LocalEmbeddings] Unable to verify model availability:', error);
      return false;
    }
  }

  /**
   * Get the configured embedding model name
   */
  getEmbeddingModel(): string {
    return this.embeddingModel;
  }

  /**
   * Normalize a vector to unit length (L2)
   */
  private normalize(vector: number[]): number[] {
    let magnitude = 0;
    for (const value of vector) {
      magnitude += value * value;
    }
    magnitude = Math.sqrt(magnitude);
    if (magnitude === 0) {
      console.warn('[LocalEmbeddings] Warning: zero-magnitude vector detected');
      return vector;
    }
    return vector.map(v => v / magnitude);
  }

  /**
   * Cache helpers
   */
  clearCache(): void {
    this.cache.clear();
  }

  getCacheStats(): { size: number; keys: number } {
    return { size: this.cache.size, keys: this.cache.size };
  }

  private addToCache(key: string, value: number[]): void {
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  private getCacheKey(text: string): string {
    return createHash('md5').update(text).digest('hex');
  }

  private embeddingDimension: number | null = null;

  async getEmbeddingDimension(): Promise<number> {
    if (this.embeddingDimension !== null) return this.embeddingDimension;
    const testEmbed = await this.embed('test');
    this.embeddingDimension = testEmbed.length;
    return this.embeddingDimension;
  }
}

/**
 * Shared embeddings instance
 */
let sharedEmbeddingsInstance: LocalEmbeddings | null = null;

export function getSharedEmbeddings(
  embeddingModel?: string,
  maxCacheSize?: number
): LocalEmbeddings {
  if (!sharedEmbeddingsInstance) {
    sharedEmbeddingsInstance = new LocalEmbeddings(
      embeddingModel,
      maxCacheSize
    );
  }
  return sharedEmbeddingsInstance;
}
