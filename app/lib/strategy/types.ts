// app/lib/strategy/types.ts
/**
 * Strategy System Types
 * Core interfaces for multi-model orchestration with ML-driven optimization
 */

import type { DetectionMode, FileType, Domain } from '../domain/contextDetector';

// ============================================================
// CORE STRATEGY RESULT
// ============================================================

export interface StrategyDecision {
  // Identification
  id: string;
  strategyName: string;
  timestamp: Date;

  // Model selection
  selectedModel: string;
  fallbackModels?: string[];

  // Multi-model workflows
  modelChain?: ModelChainConfig;
  ensembleConfig?: EnsembleConfig;

  // Parameter optimization
  temperature: number;
  maxTokens: number;
  topP?: number;
  repeatPenalty?: number;

  // Execution control
  streaming: boolean;
  enableTools: boolean;
  maxToolLoops: number;

  // Resource constraints
  resourceLimits?: ResourceConfig;

  // Analytics & reasoning
  reasoning: string;
  confidence: number; // 0-1
  complexityScore: number; // 0-100
  
  // Metadata
  metadata?: Record<string, any>;
}

// ============================================================
// MULTI-MODEL WORKFLOWS
// ============================================================

export interface ModelChainConfig {
  enabled: boolean;
  steps: ModelChainStep[];
  mergeStrategy: 'last' | 'concat' | 'vote';
}

export interface ModelChainStep {
  model: string;
  role: 'draft' | 'refine' | 'validate' | 'review' | 'critique';
  minConfidence?: number;
  maxTokens?: number;
  temperature?: number;
  systemPromptSuffix?: string;
}

export interface EnsembleConfig {
  enabled: boolean;
  models: string[];
  votingStrategy: 'majority' | 'weighted' | 'consensus' | 'best-of';
  weights?: Record<string, number>;
  minConsensusThreshold?: number; // 0-1 (default 0.7)
}

// ============================================================
// RESOURCE MANAGEMENT
// ============================================================
// Environment Variables:
// - DISABLE_RAM_CONSTRAINTS=true : Disables all RAM-based downgrades (let the machine cook!)
// - Only critical OOM protection remains (< 30% of model RAM requirement)

export interface ResourceConfig {
  maxRAM?: number;          // MB - very permissive by default (95% or unlimited if DISABLE_RAM_CONSTRAINTS=true)
  maxGPULayers?: number;    // Number of GPU layers
  maxCPUThreads?: number;   // CPU thread count
  thermalThreshold?: number; // Celsius
  batteryAware?: boolean;   // Reduce compute on battery
  maxResponseTime?: number; // ms - timeout
  maxTokens?: number;       // Maximum tokens for response
}

export interface SystemResourceInfo {
  availableRAM: number;     // MB
  availableGPU: boolean;
  gpuLayers: number;
  cpuThreads: number;
  cpuUsage: number;         // 0-100
  temperature?: number;     // Celsius
  onBattery: boolean;
  batteryLevel?: number;    // 0-100
}

// ============================================================
// STRATEGY CONTEXT
// ============================================================

export interface StrategyContext {
  // User input
  userMessage: string;
  conversationHistory: ConversationMessage[];
  
  // Domain detection (from contextDetector)
  detectedMode: DetectionMode;
  detectedDomain: Domain;
  detectedFileType: FileType;
  complexity: 'simple' | 'moderate' | 'complex';
  complexityScore: number; // 0-100 (enhanced)
  confidence: number; // 0-1
  
  // System state
  availableModels: ModelInfo[];
  systemResources: SystemResourceInfo;
  conversationMetadata: ConversationMetadata;
  
  // Manual overrides
  manualModeOverride?: DetectionMode;
  manualModelOverride?: string;
  manualStrategyOverride?: string;
  
  // Performance tracking
  recentDecisions?: RecentDecision[];
  userFeedback?: UserFeedback[];
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
  model?: string;
  tokens?: number;
}

export interface ModelInfo {
  name: string;
  displayName: string;
  size: string; // "3B", "7B", "16B"
  type: 'fast' | 'balanced' | 'quality' | 'expert';
  strengths: string[];
  weaknesses: string[];
  avgTokensPerSec?: number;
  ramRequired: number; // MB
  gpuRequired: boolean;
  contextWindow: number; // tokens
}

export interface ConversationMetadata {
  id: string;
  messageCount: number;
  totalTokens: number;
  averageResponseTime: number; // ms
  userSatisfaction?: number; // 0-1
  primaryDomain?: Domain;
}

// ============================================================
// PERFORMANCE TRACKING
// ============================================================

export interface RecentDecision {
  strategyName: string;
  selectedModel: string;
  responseTime: number; // ms
  tokensUsed: number;
  userFeedback?: 'positive' | 'negative' | 'neutral';
  errorOccurred: boolean;
  timestamp: Date;
}

export interface UserFeedback {
  messageId: string;
  rating: 'positive' | 'negative' | 'neutral';
  timestamp: Date;
  comment?: string;
}

// ============================================================
// STRATEGY OUTCOME (for analytics)
// ============================================================

export interface StrategyOutcome {
  decisionId: string;
  responseQuality: number; // 0-1
  responseTime: number; // ms
  tokensUsed: number;
  errorOccurred: boolean;
  retryCount: number;
  userFeedback?: 'positive' | 'negative' | 'neutral';
  metadata?: Record<string, any>;
}

// ============================================================
// ANALYTICS METRICS
// ============================================================

export interface PerformanceMetrics {
  strategyName: string;
  totalDecisions: number;
  successRate: number; // 0-1
  averageResponseTime: number; // ms
  averageTokens: number;
  averageQuality: number; // 0-1
  userSatisfaction: number; // 0-1
  costEfficiency: number; // tokens saved vs quality
  lastUpdated: Date;
}

export interface ModelMetrics {
  modelName: string;
  totalUsage: number;
  successRate: number; // 0-1
  averageResponseTime: number; // ms
  averageTokens: number;
  averageQuality: number; // 0-1
  bestUseCases: string[]; // ['clinical-consult', 'surgical-planning']
  worstUseCases: string[];
  lastUpdated: Date;
}

// ============================================================
// COMPLEXITY SIGNALS (Enhanced Detection)
// ============================================================

export interface ComplexitySignals {
  // Code analysis
  linesOfCode: number;
  codeBlockCount: number;
  cyclomaticComplexity: number;
  asyncPatternDepth: number;
  importCount: number;
  functionCount: number;
  classCount: number;
  
  // Content analysis
  inputLength: number;
  sentenceCount: number;
  technicalKeywordCount: number;
  questionDepth: number; // nested questions
  
  // Context analysis
  conversationDepth: number;
  domainComplexity: number; // based on Domain
  multiDomainDetected: boolean;
  
  // Final score
  overallComplexity: number; // 0-100
}

// ============================================================
// STRATEGY TYPES
// ============================================================

export type StrategyType =
  | 'balanced'      // Complexity-based (MVP)
  | 'speed'         // Always fast models
  | 'quality'       // Always best models
  | 'cost'          // Token optimization
  | 'adaptive'      // ML-driven with feedback learning
  | 'workflow';     // Multi-model workflows (Chain & Ensemble)

export type ModelSize = '3B' | '7B' | '14B' | '16B' | '32B';

// ============================================================
// EXPERIMENT TRACKING (A/B Testing)
// ============================================================

export interface StrategyExperiment {
  id: string;
  name: string;
  variantA: string; // strategy name
  variantB: string;
  startedAt: Date;
  endedAt?: Date;
  winner?: string;
  confidenceLevel: number; // 0-1
  sampleSize: number;
  results: ExperimentResults;
}

export interface ExperimentResults {
  variantA: ExperimentMetrics;
  variantB: ExperimentMetrics;
  statisticalSignificance: number; // p-value
}

export interface ExperimentMetrics {
  strategy: string;
  sampleSize: number;
  successRate: number;
  avgResponseTime: number;
  avgQuality: number;
  userSatisfaction: number;
}

// ============================================================
// ERROR TYPES
// ============================================================

export class StrategyError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'StrategyError';
  }
}

export class ResourceConstraintError extends StrategyError {
  constructor(message: string, details?: any) {
    super(message, 'RESOURCE_CONSTRAINT', details);
    this.name = 'ResourceConstraintError';
  }
}

export class ModelUnavailableError extends StrategyError {
  constructor(message: string, details?: any) {
    super(message, 'MODEL_UNAVAILABLE', details);
    this.name = 'ModelUnavailableError';
  }
}
