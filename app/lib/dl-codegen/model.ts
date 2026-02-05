// lib/dl-codegen/model.ts
// PyTorch deep NN via Flask server - multi-layer feedforward for code completion
import type { Prediction } from './types';

const FLASK_HOST = process.env.DL_SERVER_HOST || 'http://127.0.0.1:5001';

export async function loadModel(modelPath: string): Promise<string> {
  // Flask server loads model on-demand during prediction
  // Just return the model path for the predict call
  return modelPath;
}

export async function predictCodeCompletion(
  modelPath: string,
  inputFeatures: Float32Array[]
): Promise<Prediction> {
  try {
    const response = await fetch(`${FLASK_HOST}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelPath,
        features: Array.from(inputFeatures[0]) // Convert Float32Array to regular array for JSON
      })
    });

    if (!response.ok) {
      throw new Error(`Prediction failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    // Flask returns: { completion_idx: number, confidence: number }
    const completion = decodePrediction(result.completion_idx);

    return {
      completion,
      confidence: result.confidence,
      features: inputFeatures[0]
    };
  } catch (error) {
    console.error('[Model] Prediction error:', error);
    throw error;
  }
}

function decodePrediction(idx: number): string {
  // Production: vocab mapping (train vocab.json)
  const vocab = ['def ', 'async ', 'function ', 'import ', 'class ', 'return', 'if ', 'for ', 'while'];
  return vocab[idx] || '';
}
