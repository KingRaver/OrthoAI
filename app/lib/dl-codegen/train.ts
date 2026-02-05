// lib/dl-codegen/train.ts
// Production training pipeline via Flask server with backprop, regularization, evaluation
import type { DLConfig } from './types';

const FLASK_HOST = process.env.DL_SERVER_HOST || 'http://127.0.0.1:5001';

export async function trainModel(
  dataset: Float32Array[],
  modelPath: string,
  config: DLConfig
): Promise<{ loss: number; accuracy: number }> {
  try {
    // Convert Float32Array to regular arrays for JSON serialization
    const datasetArray = dataset.map(arr => Array.from(arr));

    const response = await fetch(`${FLASK_HOST}/train`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dataset: datasetArray,
        modelPath,
        config: {
          batchSize: config.batchSize,
          epochs: config.epochs,
          lr: config.lr,
          hiddenLayers: config.hiddenLayers,
          dropout: config.dropout
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Training failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();

    return {
      loss: result.loss,
      accuracy: result.accuracy
    };
  } catch (error) {
    console.error('[Train] Training error:', error);
    throw error;
  }
}
