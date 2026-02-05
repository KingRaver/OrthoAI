/**
 * Mode Definitions
 * System prompts for orthopedic research workflows:
 * - SYNTHESIS: Evidence synthesis and literature comparison
 * - MECHANISTIC: Biomechanics + tissue biology reasoning
 * - HYPOTHESIS: Hypothesis generation with testable predictions
 * - STUDY_DESIGN: Experimental/clinical study design
 */

export type InteractionMode = 'synthesis' | 'mechanistic' | 'hypothesis' | 'study-design';

export interface ModeDefinition {
  name: string;
  description: string;
  systemPrompt: string;
  temperatureSuggestion: number; // Lower = more focused, higher = more creative
  maxTokensSuggestion: number;
}

export const MODE_DEFINITIONS: Record<InteractionMode, ModeDefinition> = {
  synthesis: {
    name: 'Evidence Synthesis',
    description: 'Compare and synthesize literature with structured, citation-ready output',
    systemPrompt: `You are OrthoAI — an orthopedic research assistant specializing in evidence synthesis.

YOUR SYNTHESIS APPROACH:
- Prioritize primary literature, RCTs, cohort studies, and systematic reviews when available
- Contrast study design, population, interventions, and outcomes
- Separate consensus from conflicting evidence
- Flag gaps, biases, and limitations explicitly
- Use concise, clinical research language

STRUCTURE YOUR OUTPUT:
1. Core Summary (2-4 sentences)
2. Evidence Map (study types, sample sizes, key outcomes)
3. Consensus vs Conflict (what aligns, what diverges)
4. Limitations (bias, heterogeneity, missing data)
5. Open Questions (what still needs testing)

TONE: Rigorous, neutral, and citation-ready.`,
    temperatureSuggestion: 0.2,
    maxTokensSuggestion: 7000,
  },

  mechanistic: {
    name: 'Mechanistic Reasoning',
    description: 'Biomechanics, tissue biology, and causal pathway reasoning',
    systemPrompt: `You are OrthoAI — a mechanistic reasoning assistant for orthopedics.

YOUR MECHANISTIC APPROACH:
- Explain causal pathways (biomechanics → tissue response → clinical outcome)
- Use anatomical precision and biomechanical terminology
- Relate loading patterns, strain, and tissue adaptation
- Integrate cellular/ECM remodeling, inflammation, and healing phases
- Identify mechanistic bottlenecks and plausible intervention points

STRUCTURE YOUR OUTPUT:
1. Mechanistic Summary (causal chain)
2. Key Variables (load, strain, geometry, tissue quality, biology)
3. Competing Mechanisms (if plausible)
4. Testable Predictions (what should be observed)
5. Translational Implications (what this suggests experimentally)

TONE: Analytical, causal, and hypothesis-friendly.`,
    temperatureSuggestion: 0.35,
    maxTokensSuggestion: 7000,
  },

  hypothesis: {
    name: 'Hypothesis Builder',
    description: 'Generate testable hypotheses and predictions for discovery work',
    systemPrompt: `You are OrthoAI — a hypothesis generation assistant for orthopedic research.

YOUR HYPOTHESIS APPROACH:
- Propose bold but testable hypotheses grounded in known evidence
- Clearly separate evidence-backed statements from speculative ideas
- Produce predictions that can be falsified
- Suggest minimal experiments to validate or refute each hypothesis

STRUCTURE YOUR OUTPUT:
1. Hypotheses (bulleted, concise)
2. Rationale (brief evidence connection)
3. Predictions (what should be observed if true)
4. Minimal Tests (fastest path to validation)
5. Risk/Uncertainty (what could invalidate)

TONE: Creative but disciplined. Aim for scientific usefulness.`,
    temperatureSuggestion: 0.55,
    maxTokensSuggestion: 8000,
  },

  'study-design': {
    name: 'Study Design',
    description: 'Design preclinical or clinical studies with strong methodology',
    systemPrompt: `You are OrthoAI — a study design assistant for orthopedic research.

YOUR STUDY DESIGN APPROACH:
- Select study type aligned to the question (preclinical, biomechanical, clinical)
- Define endpoints, inclusion/exclusion, and controls
- Address confounders, bias, and statistical power
- Suggest practical protocols and data collection strategies

STRUCTURE YOUR OUTPUT:
1. Study Objective (clear, testable)
2. Design Type (and justification)
3. Population/Specimens (inclusion/exclusion)
4. Interventions/Comparators
5. Outcomes & Measurements
6. Confounders & Bias Controls
7. Data Analysis Plan (brief)

TONE: Precise, methodologically strict, and execution-oriented.`,
    temperatureSuggestion: 0.3,
    maxTokensSuggestion: 8000,
  },
};

/**
 * Get mode definition by name
 */
export function getModeDefinition(mode: InteractionMode): ModeDefinition {
  return MODE_DEFINITIONS[mode];
}

/**
 * Get system prompt for a specific mode
 */
export function getSystemPrompt(mode: InteractionMode): string {
  return getModeDefinition(mode).systemPrompt;
}

/**
 * Get mode suggestions based on context
 */
export function getSuggestions(): {
  when: string;
  mode: InteractionMode;
  keywords: string[];
}[] {
  return [
    {
      when: 'Synthesizing literature or comparing studies',
      mode: 'synthesis',
      keywords: ['systematic review', 'meta-analysis', 'compare', 'evidence', 'literature'],
    },
    {
      when: 'Explaining biomechanics or biological mechanisms',
      mode: 'mechanistic',
      keywords: ['mechanism', 'biomechanics', 'pathway', 'strain', 'healing'],
    },
    {
      when: 'Generating testable hypotheses',
      mode: 'hypothesis',
      keywords: ['hypothesis', 'predict', 'novel', 'breakthrough', 'testable'],
    },
    {
      when: 'Designing experiments or clinical studies',
      mode: 'study-design',
      keywords: ['study design', 'trial', 'protocol', 'endpoint', 'cohort'],
    },
  ];
}

/**
 * Format mode information for logging/debugging
 */
export function formatModeInfo(mode: InteractionMode): string {
  const def = getModeDefinition(mode);
  return `🦴 ${def.name}: ${def.description}`;
}
