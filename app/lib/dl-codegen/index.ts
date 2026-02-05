// lib/dl-codegen/index.ts
// Production DL CodeGen orchestrator for Hacker Reign - integrates with LLM pipeline
import { preprocessCodeData } from './preprocess';
import { loadModel, predictCodeCompletion } from './model';
import { trainModel } from './train';
import type { CodeDataset, DLConfig, Prediction } from './types';
import { createHash } from 'crypto';

export class DLCodeGen {
  private modelPath = `${process.cwd()}/.data/dl-model.pt`;
  private config: DLConfig = {
    hiddenLayers: [512, 256, 128, 64],
    dropout: 0.2,
    lr: 0.001,
    epochs: 50,
    batchSize: 64,
    embeddingDim: 384, // Matches nomic-embed-text
  };

  // Prediction cache: Map<cacheKey, {prediction, timestamp}>
  private predictionCache: Map<string, {prediction: Prediction, timestamp: number}> = new Map();
  private maxCacheSize = 500; // Cache up to 500 predictions
  private cacheExpiryMs = 1000 * 60 * 30; // 30 minutes

  async predict(prompt: string, context: string[] = []): Promise<Prediction> {
    const startTime = performance.now();

    // Create cache key from prompt + context
    const cacheKey = this.getCacheKey(prompt, context);

    // Check cache first
    const cached = this.predictionCache.get(cacheKey);
    if (cached) {
      const age = Date.now() - cached.timestamp;
      if (age < this.cacheExpiryMs) {
        // Cache hit - return cached prediction
        const cacheHitTime = performance.now() - startTime;
        console.log(`[DL-Performance] Cache HIT - Total: ${cacheHitTime.toFixed(2)}ms`);
        return cached.prediction;
      } else {
        // Expired - remove from cache
        this.predictionCache.delete(cacheKey);
      }
    }

    console.log(`[DL-Performance] Cache MISS - Computing prediction...`);

    // Cache miss - compute prediction
    const combinedInput = [prompt, ...context].join('\n');

    const preprocessStart = performance.now();
    const data = await preprocessCodeData(combinedInput);
    const preprocessTime = performance.now() - preprocessStart;

    const modelLoadStart = performance.now();
    const model = await loadModel(this.modelPath);
    const modelLoadTime = performance.now() - modelLoadStart;

    const inferenceStart = performance.now();
    const prediction = await predictCodeCompletion(model, data);
    const inferenceTime = performance.now() - inferenceStart;

    const totalTime = performance.now() - startTime;

    console.log(`[DL-Performance] Breakdown:
  - Preprocessing: ${preprocessTime.toFixed(2)}ms
  - Model Load: ${modelLoadTime.toFixed(2)}ms
  - Inference: ${inferenceTime.toFixed(2)}ms
  - Total: ${totalTime.toFixed(2)}ms
  - Confidence: ${(prediction.confidence * 100).toFixed(1)}%`);

    // Add to cache with LRU eviction
    this.addToPredictionCache(cacheKey, prediction);

    return prediction;
  }

  private getCacheKey(prompt: string, context: string[]): string {
    // Hash the combined input for cache key
    const combined = [prompt, ...context].join('\n');
    return createHash('md5').update(combined).digest('hex');
  }

  private addToPredictionCache(key: string, prediction: Prediction): void {
    // LRU eviction: remove oldest if cache is full
    if (this.predictionCache.size >= this.maxCacheSize) {
      const firstKey = this.predictionCache.keys().next().value;
      if (firstKey) {
        this.predictionCache.delete(firstKey);
      }
    }

    this.predictionCache.set(key, {
      prediction,
      timestamp: Date.now()
    });
  }

  clearPredictionCache(): void {
    this.predictionCache.clear();
  }

  getCacheStats(): {size: number, maxSize: number} {
    return {
      size: this.predictionCache.size,
      maxSize: this.maxCacheSize
    };
  }

  async train(datasetPath: string): Promise<{ loss: number; accuracy: number }> {
    const dataset = await preprocessCodeData(datasetPath);
    return trainModel(dataset, this.modelPath, this.config);
  }

  static getInstance(): DLCodeGen {
    return new DLCodeGen();
  }
}

export default DLCodeGen;
