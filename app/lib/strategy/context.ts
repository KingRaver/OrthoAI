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

type DetectionMode =
  | 'clinical-consult'
  | 'treatment-decision'
  | 'surgical-planning'
  | 'complications-risk'
  | 'imaging-dx'
  | 'rehab-rtp'
  | 'evidence-brief'
  | null;

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
    strengths: ['clinical consults', 'surgical planning', 'evidence briefs'],
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
  conversationId?: string;
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
    conversationId: params.conversationId,
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
 * Higher scores = more thorough response needed
 */
function calculateComplexityScore(
  baseComplexity: 'simple' | 'moderate' | 'complex',
  userMessage: string
): number {
  // Start with base score
  let score = baseComplexity === 'simple' ? 25 : baseComplexity === 'moderate' ? 55 : 85;

  const messageLength = userMessage.length;

  // Surgical/procedural keywords
  const hasSurgery = /\b(surgery|surgical|operative|approach|technique|implant|fixation|procedure|reconstruction|repair|lengthening|transfer|release|fusion|arthroplasty|arthroscopy)\b/i.test(userMessage);

  // Anatomical structures (indicates clinical query)
  const hasAnatomy = /\b(tendon|ligament|muscle|bone|joint|achilles|tibial|fibula|tibia|rotator|meniscus|cartilage|nerve|artery|fascia|capsule)\b/i.test(userMessage);

  // Clinical conditions/pathology
  const hasPathology = /\b(tear|rupture|fracture|dislocation|sprain|strain|atrophy|contracture|shortened|deformity|injury|trauma|wound|GSW|gunshot|laceration|avulsion)\b/i.test(userMessage);

  // Complications and risks
  const hasComplications = /\b(complication|risk|infection|revision|failure|nonunion|malunion|stiffness|weakness|pain|dysfunction|deficit)\b/i.test(userMessage);

  // Evidence/guidelines
  const hasEvidence = /\b(guideline|systematic review|meta-analysis|cohort|case-control|RCT|evidence|study|literature|research)\b/i.test(userMessage);

  // Imaging
  const hasImaging = /\b(MRI|ultrasound|CT|radiograph|x-ray|imaging|scan)\b/i.test(userMessage);

  // Rehabilitation
  const hasRehab = /\b(rehab|rehabilitation|physical therapy|PT|return to|RTP|protocol|recovery|weight.?bearing|ROM|range of motion)\b/i.test(userMessage);

  // Treatment intent indicators
  const hasTreatmentIntent = /\b(treatment|option|procedure|what.*(do|would|should)|how.*(treat|fix|repair)|recommend|best|approach)\b/i.test(userMessage);

  // Active lifestyle / functional goals
  const hasFunctionalGoals = /\b(walk|run|sport|active|lifestyle|return to|play|work|function|mobility|strength)\b/i.test(userMessage);

  const lineCount = userMessage.split('\n').length;

  // Add complexity for each matched category
  if (messageLength > 300) score += 8;
  if (messageLength > 600) score += 8;
  if (hasSurgery) score += 15;
  if (hasAnatomy) score += 12;
  if (hasPathology) score += 15;
  if (hasComplications) score += 10;
  if (hasEvidence) score += 8;
  if (hasImaging) score += 8;
  if (hasRehab) score += 8;
  if (hasTreatmentIntent) score += 10;
  if (hasFunctionalGoals) score += 8;
  if (lineCount > 10) score += 5;

  // Clinical queries should have minimum complexity of 35 to ensure good responses
  if (hasAnatomy || hasPathology || hasSurgery) {
    score = Math.max(score, 35);
  }

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
