// lib/dl-codegen/types.ts
export interface CodeDataset {
  inputs: string[];
  targets: string[];
}

export interface DLConfig {
  hiddenLayers: number[];
  dropout: number;
  lr: number;
  epochs: number;
  batchSize: number;
  embeddingDim: number;
}

export interface Prediction {
  completion: string;
  confidence: number;
  features: Float32Array;
}
