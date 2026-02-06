/**
 * Context Detector - Orthopedic Clinical Edition
 * Detects:
 * - Mode (Clinical consult, Surgical planning, Complications/risk, Imaging dx, Rehab/RTP, Evidence brief)
 * - Content type (paper, protocol, imaging, dataset)
 * - Primary domain (clinical, surgical, biomechanics, tissue biology, imaging, rehab)
 * - Complexity score (0-100)
 */

import type { ComplexitySignals } from '../strategy/types';

export type DetectionMode =
  | 'clinical-consult'
  | 'treatment-decision'
  | 'surgical-planning'
  | 'complications-risk'
  | 'imaging-dx'
  | 'rehab-rtp'
  | 'evidence-brief'
  | null;
export type DetectionModeNonNull =
  | 'clinical-consult'
  | 'treatment-decision'
  | 'surgical-planning'
  | 'complications-risk'
  | 'imaging-dx'
  | 'rehab-rtp'
  | 'evidence-brief';
export type FileType = 'paper' | 'protocol' | 'imaging' | 'dataset' | 'unknown';
export type Domain =
  | 'orthopedics-clinical'
  | 'orthopedics-surgical'
  | 'biomechanics'
  | 'tissue-biology'
  | 'imaging'
  | 'rehabilitation'
  | 'mixed'
  | null;

export interface DetectionResult {
  mode: DetectionMode;
  fileType: FileType;
  domain: Domain;
  complexity: 'simple' | 'moderate' | 'complex';
  confidence: number; // 0-1
  detectedKeywords: string[];
  reasoning: string;
}

// ENHANCED VERSION with complexity score
export interface EnhancedDetectionResult extends DetectionResult {
  complexityScore: number; // 0-100
  complexitySignals: ComplexitySignals; // detailed signals
}

/**
 * Keyword patterns for mode detection
 */
const MODE_PATTERNS = {
  'clinical-consult': [
    /\b(assessment|diagnosis|plan|management|workup)\b/i,
    /\b(differential|ddx|recommendation|next steps)\b/i,
    /\b(pain|swelling|instability|function|symptoms)\b/i,
  ],
  'treatment-decision': [
    /\b(conservative|nonoperative|non-operative|operative)\b/i,
    /\b(surgery vs|vs surgery|or surgery|treat conservatively)\b/i,
    /\b(should I operate|indication for surgery|surgical candidate)\b/i,
    /\b(treatment options|management options|when to operate)\b/i,
  ],
  'surgical-planning': [
    /\b(surgical|operative|approach|technique|steps|procedure)\b/i,
    /\b(implant|fixation|graft|suture|anchor|osteotomy)\b/i,
    /\b(positioning|exposure|fluoro|arthroscopy)\b/i,
  ],
  'complications-risk': [
    /\b(complication|risk|failure|revision|reoperation|infection)\b/i,
    /\b(nonunion|malunion|hardware|neurovascular)\b/i,
    /\b(thrombosis|bleeding|wound|delayed healing)\b/i,
  ],
  'imaging-dx': [
    /\b(MRI|CT|ultrasound|radiograph|x-ray)\b/i,
    /\b(T1|T2|PD|STIR|contrast|sequence)\b/i,
    /\b(imaging|scan|read|report|finding)\b/i,
  ],
  'rehab-rtp': [
    /\b(rehab|physical therapy|PT|return to play|RTP)\b/i,
    /\b(progressive loading|eccentric|isometric|protocol)\b/i,
    /\b(strength|range of motion|ROM|functional test)\b/i,
  ],
  'evidence-brief': [
    /\b(evidence|guideline|consensus|recommendation)\b/i,
    /\b(systematic review|meta-analysis|RCT|cohort)\b/i,
    /\b(best practice|society statement|level of evidence)\b/i,
  ],
};

/**
 * Content type patterns
 */
const FILE_TYPE_PATTERNS: Record<FileType, RegExp[]> = {
  paper: [
    /\.pdf\b/i,
    /\b(doi:|preprint|journal|systematic review|meta-analysis)\b/i,
  ],
  protocol: [
    /\b(protocol|clinicaltrials\.gov|registered trial|trial registration)\b/i,
    /\b(randomized|allocation|blinding)\b/i,
  ],
  imaging: [
    /\b(MRI|CT|ultrasound|radiograph|x-ray|T1|T2|PD)\b/i,
  ],
  dataset: [
    /\b(dataset|registry|database|cohort data|csv|metadata)\b/i,
  ],
  unknown: [],
};

export class ContextDetector {
  /**
   * Analyze complexity with research signals (0-100)
   */
  static analyzeComplexity(input: string, domain?: Domain): ComplexitySignals {
    const signals: ComplexitySignals = {
      linesOfCode: 0,
      codeBlockCount: 0,
      cyclomaticComplexity: 0,
      asyncPatternDepth: 0,
      importCount: 0,
      functionCount: 0,
      classCount: 0,
      inputLength: input.length,
      sentenceCount: (input.match(/[.!?]+/g) || []).length,
      technicalKeywordCount: 0,
      questionDepth: 0,
      conversationDepth: 1,
      domainComplexity: 0,
      multiDomainDetected: false,
      overallComplexity: 0
    };

    // Track structured blocks (papers/protocols often pasted)
    const codeBlocks = input.match(/```[\s\S]*?```/g) || [];
    signals.codeBlockCount = codeBlocks.length;

    // Research-specific technical keywords
    const technicalKeywords = [
      'randomized', 'double-blind', 'placebo', 'cohort', 'case-control',
      'meta-analysis', 'systematic review', 'p-value', 'confidence interval',
      'effect size', 'hazard ratio', 'odds ratio', 'risk ratio',
      'biomechanics', 'kinematics', 'tendon', 'ligament', 'cartilage',
      'arthroscopy', 'reconstruction', 'repair', 'graft',
      'MRI', 'ultrasound', 'CT', 'radiograph',
      'ECM', 'collagen', 'inflammation', 'angiogenesis', 'tenocyte'
    ];

    technicalKeywords.forEach(keyword => {
      if (input.toLowerCase().includes(keyword.toLowerCase())) {
        signals.technicalKeywordCount++;
      }
    });

    // Question depth
    const questions = input.split(/[.!]/).filter(s => s.includes('?'));
    signals.questionDepth = questions.length;

    // Domain complexity weighting
    const domainComplexityMap: Record<string, number> = {
      'orthopedics-clinical': 60,
      'orthopedics-surgical': 70,
      'biomechanics': 75,
      'tissue-biology': 80,
      'imaging': 55,
      'rehabilitation': 50,
      'mixed': 85
    };

    if (domain) {
      signals.domainComplexity = domainComplexityMap[domain] || 0;
    }

    // Detect multi-domain signal
    const hasClinical = /\b(clinical|patient|outcome|trial|cohort)\b/i.test(input);
    const hasSurgical = /\b(arthroscopy|repair|reconstruction|implant|fixation)\b/i.test(input);
    const hasBiomech = /\b(load|strain|stress|kinematics|gait|torque)\b/i.test(input);
    const hasBio = /\b(ECM|collagen|inflammation|angiogenesis|tenocyte|stem cell)\b/i.test(input);
    const hasImaging = /\b(MRI|ultrasound|CT|radiograph)\b/i.test(input);
    const hasRehab = /\b(rehab|physical therapy|return to play|eccentric|isometric)\b/i.test(input);

    signals.multiDomainDetected = [hasClinical, hasSurgical, hasBiomech, hasBio, hasImaging, hasRehab].filter(Boolean).length > 1;

    // Overall complexity score
    const score = Math.min(100,
      (signals.technicalKeywordCount * 2.0) +
      (signals.questionDepth * 2.0) +
      (signals.multiDomainDetected ? 12 : 0) +
      Math.min(signals.inputLength / 30, 25)
    );

    signals.overallComplexity = Math.round(score);

    return signals;
  }

  /**
   * Detect with complexity score
   */
  static detectEnhanced(
    userInput: string,
    filePath?: string,
    conversationDepth: number = 1
  ): EnhancedDetectionResult {
    const baseDetection = this.detect(userInput, filePath);
    const signals = this.analyzeComplexity(userInput, baseDetection.domain);
    signals.conversationDepth = conversationDepth;

    return {
      ...baseDetection,
      complexityScore: signals.overallComplexity,
      complexitySignals: signals,
      complexity: signals.overallComplexity < 30 ? 'simple' :
                 signals.overallComplexity < 70 ? 'moderate' : 'complex'
    };
  }

  /**
   * Detect all context from user input
   */
  static detect(userInput: string, filePath?: string): DetectionResult {
    const mode = this.detectMode(userInput);
    const fileType = this.detectFileType(userInput, filePath);
    const domain = this.detectDomain(userInput, fileType);
    const complexity = this.detectComplexity(userInput);
    const detectedKeywords = this.extractKeywords(userInput);

    const confidence = this.calculateConfidence(mode, fileType, userInput);
    const reasoning = this.buildReasoning(mode, fileType, domain, userInput);

    return {
      mode,
      fileType,
      domain,
      complexity,
      confidence,
      detectedKeywords,
      reasoning,
    };
  }

  /**
   * Detect which mode best matches the input
   */
  private static detectMode(input: string): DetectionMode {
    const scores: Record<string, number> = {
      'clinical-consult': 0,
      'treatment-decision': 0,
      'surgical-planning': 0,
      'complications-risk': 0,
      'imaging-dx': 0,
      'rehab-rtp': 0,
      'evidence-brief': 0,
    };

    Object.entries(MODE_PATTERNS).forEach(([mode, patterns]) => {
      patterns.forEach(pattern => {
        if (pattern.test(input)) {
          scores[mode]++;
        }
      });
    });

    const sorted = Object.entries(scores)
      .filter(([, score]) => score > 0)
      .sort((a, b) => b[1] - a[1]);

    if (sorted.length === 0) return null;
    return (sorted[0][0] as DetectionMode);
  }

  /**
   * Detect file type from input or file path
   */
  private static detectFileType(input: string, filePath?: string): FileType {
    const combinedInput = `${input} ${filePath || ''}`;
    const scores: Record<FileType, number> = {
      paper: 0,
      protocol: 0,
      imaging: 0,
      dataset: 0,
      unknown: 0,
    };

    Object.entries(FILE_TYPE_PATTERNS).forEach(([type, patterns]) => {
      patterns.forEach(pattern => {
        if (pattern.test(combinedInput)) {
          scores[type as FileType]++;
        }
      });
    });

    const sorted = Object.entries(scores)
      .filter(([, score]) => score > 0)
      .sort((a, b) => b[1] - a[1]);

    if (sorted.length === 0) return 'unknown';
    return (sorted[0][0] as FileType);
  }

  /**
   * Detect primary domain (clinical, surgical, biomechanics, etc.)
   */
  private static detectDomain(input: string, fileType: FileType): Domain {
    const clinicalPatterns = /\b(clinical|patient|outcome|trial|cohort|case series|guideline)\b/i;
    const surgicalPatterns = /\b(arthroscopy|repair|reconstruction|implant|fixation|graft|suture|osteotomy)\b/i;
    const biomechanicsPatterns = /\b(load|strain|stress|kinematics|gait|moment|torque|tensile)\b/i;
    const biologyPatterns = /\b(ECM|collagen|inflammation|angiogenesis|tenocyte|fibroblast|stem cell|PRP)\b/i;
    const imagingPatterns = /\b(MRI|ultrasound|CT|radiograph|x-ray)\b/i;
    const rehabPatterns = /\b(rehab|physical therapy|return to play|eccentric|isometric|progressive loading)\b/i;

    const hasClinical = clinicalPatterns.test(input);
    const hasSurgical = surgicalPatterns.test(input);
    const hasBiomech = biomechanicsPatterns.test(input);
    const hasBio = biologyPatterns.test(input);
    const hasImaging = imagingPatterns.test(input) || fileType === 'imaging';
    const hasRehab = rehabPatterns.test(input);

    const domains = [hasClinical, hasSurgical, hasBiomech, hasBio, hasImaging, hasRehab].filter(Boolean).length;
    if (domains > 1) return 'mixed';

    if (hasSurgical) return 'orthopedics-surgical';
    if (hasClinical) return 'orthopedics-clinical';
    if (hasBiomech) return 'biomechanics';
    if (hasBio) return 'tissue-biology';
    if (hasImaging) return 'imaging';
    if (hasRehab) return 'rehabilitation';

    return null;
  }

  /**
   * Detect complexity level
   */
  private static detectComplexity(input: string): 'simple' | 'moderate' | 'complex' {
    const signals = this.analyzeComplexity(input);
    const score = signals.overallComplexity;

    if (score < 30) return 'simple';
    if (score < 70) return 'moderate';
    return 'complex';
  }

  /**
   * Extract detected keywords for logging
   */
  private static extractKeywords(input: string): string[] {
    const keywords: string[] = [];

    Object.entries(MODE_PATTERNS).forEach(([mode, patterns]) => {
      patterns.forEach(pattern => {
        const matches = input.match(pattern);
        if (matches) {
          keywords.push(`[${mode}]`, matches[0]);
        }
      });
    });

    return Array.from(new Set(keywords)).slice(0, 10);
  }

  /**
   * Calculate confidence (0-1) based on pattern matches
   */
  private static calculateConfidence(mode: DetectionMode, fileType: FileType, input: string): number {
    let score = 0;

    if (mode !== null) score += 0.35;
    if (fileType !== 'unknown') score += 0.2;

    if (input.length > 200) score += 0.15;
    if ((input.match(/\b(please|need|want|analyze)\b/gi) || []).length > 0) score += 0.1;
    if ((input.match(/\b(surgery|operative|complication|imaging|rehab|guideline|evidence)\b/gi) || []).length > 0) score += 0.2;

    return Math.min(1, score);
  }

  /**
   * Build human-readable reasoning for detection
   */
  private static buildReasoning(
    mode: DetectionMode,
    fileType: FileType,
    domain: Domain,
    input: string
  ): string {
    const parts: string[] = [];
    const trimmed = input.trim();
    const inputTag = trimmed ? `Input length: ${Math.min(trimmed.length, 10000)} chars` : 'Empty input';

    if (mode) {
      parts.push(`Detected ${mode} mode`);
    }

    if (fileType !== 'unknown') {
      parts.push(`${fileType} content detected`);
    }

    if (domain) {
      parts.push(`Primary domain: ${domain.replace('-', ' ')}`);
    }

    parts.push(inputTag);
    return parts.join(' • ');
  }

  /**
   * Get confidence description
   */
  static getConfidenceLevel(confidence: number): string {
    if (confidence >= 0.8) return 'Very High';
    if (confidence >= 0.6) return 'High';
    if (confidence >= 0.4) return 'Moderate';
    return 'Low';
  }
}
