// app/lib/strategy/context.ts
import { StrategyContext, RecentDecision } from './types';
import { ContextDetector } from '../domain/contextDetector';
import { getSystemResources } from './resources/monitor';

/**
 * Strategy Context Builder
 * Bridges domain detection with strategy system
 */

interface ModelInfo {
  name: string;
  displayName: string;
  size: string;
  type: 'fast' | 'balanced' | 'expert';
  strengths: string[];
  weaknesses: string[];
  ramRequired: number;
  gpuRequired: boolean;
  contextWindow: number;
}

interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  tokens?: number;
  timestamp?: Date;
}

interface ConversationMetadata {
  id: string;
  messageCount: number;
  totalTokens: number;
  averageResponseTime: number;
  userSatisfaction: number;
}

type DetectionMode = 'synthesis' | 'mechanistic' | 'hypothesis' | 'study-design' | null;

const DEFAULT_MODELS: ModelInfo[] = [
  {
    name: 'biogpt',
    displayName: 'BioGPT (Extraction)',
    size: '3B',
    type: 'fast',
    strengths: ['biomedical entity extraction', 'fast summaries'],
    weaknesses: ['instruction following', 'long-form synthesis'],
    ramRequired: 3000,
    gpuRequired: false,
    contextWindow: 4096
  },
  {
    name: 'biomistral-7b-instruct',
    displayName: 'BioMistral 7B',
    size: '7B',
    type: 'balanced',
    strengths: ['evidence synthesis', 'mechanistic reasoning', 'study design'],
    weaknesses: ['very long chain-of-thought tasks'],
    ramRequired: 8000,
    gpuRequired: true,
    contextWindow: 8192
  }
];

export async function buildStrategyContext(params: {
  userMessage: string;
  conversationHistory: ConversationMessage[];
  filePath?: string;
  manualModeOverride?: DetectionMode;
  manualModelOverride?: string;
}): Promise<StrategyContext> {
  // 1. Use existing context detector
  const detection = ContextDetector.detect(
    params.userMessage,
    params.filePath
  );

  // Enhanced complexity score (0-100 scale)
  const complexityScore = calculateComplexityScore(detection.complexity, params.userMessage);

  // 2. System resources
  const systemResources = await getSystemResources();

  // 3. Conversation metadata
  const metadata = calculateConversationMetadata(params.conversationHistory);

  // 4. Recent decisions (stub for now)
  const recentDecisions: RecentDecision[] = [];

  return {
    userMessage: params.userMessage,
    conversationHistory: params.conversationHistory,
    detectedMode: params.manualModeOverride || detection.mode,
    detectedDomain: detection.domain,
    detectedFileType: detection.fileType,
    complexity: detection.complexity,
    complexityScore: complexityScore,
    confidence: detection.confidence,
    availableModels: DEFAULT_MODELS,
    systemResources,
    conversationMetadata: metadata,
    manualModeOverride: params.manualModeOverride,
    manualModelOverride: params.manualModelOverride,
    recentDecisions,
    userFeedback: []
  };
}

/**
 * Calculate enhanced complexity score (0-100)
 */
function calculateComplexityScore(
  baseComplexity: 'simple' | 'moderate' | 'complex',
  userMessage: string
): number {
  let score = baseComplexity === 'simple' ? 20 : baseComplexity === 'moderate' ? 50 : 80;

  const messageLength = userMessage.length;
  const hasStudyDesign = /\b(trial|protocol|randomized|endpoint|sample size|power)\b/i.test(userMessage);
  const hasMechanism = /\b(mechanism|pathway|biomechanics|strain|stress|collagen|ECM)\b/i.test(userMessage);
  const hasEvidence = /\b(systematic review|meta-analysis|cohort|case-control|RCT)\b/i.test(userMessage);
  const hasImaging = /\b(MRI|ultrasound|CT|radiograph)\b/i.test(userMessage);
  const lineCount = userMessage.split('\n').length;

  if (messageLength > 500) score += 10;
  if (messageLength > 1000) score += 10;
  if (hasStudyDesign) score += 12;
  if (hasMechanism) score += 10;
  if (hasEvidence) score += 8;
  if (hasImaging) score += 6;
  if (lineCount > 50) score += 6;

  return Math.min(100, Math.max(0, score));
}

function calculateConversationMetadata(history: ConversationMessage[]): ConversationMetadata {
  const totalTokens = history.reduce((sum, msg) => sum + (msg.tokens || 0), 0);
  const assistantMsgs = history.filter(m => m.role === 'assistant');
  const avgResponseTime = assistantMsgs.length > 0
    ? assistantMsgs.reduce((sum, msg) => sum + (msg.timestamp ? Date.now() - msg.timestamp.getTime() : 0), 0) / assistantMsgs.length / 1000
    : 0;

  return {
    id: 'conv_' + Date.now(),
    messageCount: history.length,
    totalTokens,
    averageResponseTime: avgResponseTime,
    userSatisfaction: 0.8
  };
}
