/**
 * Domain Knowledge Base - Orthopedic Research
 * Curated domain context injected into system prompts
 */

import type { Domain } from './contextDetector';

export interface DomainKnowledge {
  domain:
    | 'orthopedics-clinical'
    | 'orthopedics-surgical'
    | 'biomechanics'
    | 'tissue-biology'
    | 'imaging'
    | 'rehabilitation';
  concepts: string[];
  bestPractices: string[];
  commonPitfalls: string[];
  contextPrompt: string;
}

/**
 * CLINICAL ORTHOPEDICS
 */
export const ORTHO_CLINICAL_KNOWLEDGE: DomainKnowledge = {
  domain: 'orthopedics-clinical',
  concepts: [
    'Clinical presentation and functional outcomes',
    'Patient-reported outcome measures (PROMs)',
    'Impairment vs disability vs function',
    'Natural history and prognosis',
    'Comparative effectiveness (RCTs vs cohorts)',
    'Indications and contraindications',
    'Complication profiles and risk stratification',
  ],
  bestPractices: [
    'Distinguish symptom relief from structural healing',
    'Prioritize validated outcome measures (e.g., FAOS, AOFAS, IKDC)',
    'Separate acute vs chronic pathology cohorts',
    'Report effect sizes and confidence intervals, not just p-values',
    'Control for confounders (age, activity level, comorbidities)',
  ],
  commonPitfalls: [
    'Pooling heterogeneous cohorts without subgroup analysis',
    'Overreliance on radiographic findings without functional outcomes',
    'Inadequate follow-up for long-term outcomes',
    'Underreporting complications or re-injury rates',
    'Selection bias in surgical vs conservative cohorts',
  ],
  contextPrompt: `You are operating in a clinical orthopedic context.

FOCUS ON:
- Outcome measures and functional endpoints
- Evidence hierarchy and study design quality
- Indications, risks, and comparative effectiveness
- Heterogeneity of patient populations

AVOID:
- Overgeneralizing results across distinct cohorts
- Ignoring confounders or follow-up duration`,
};

/**
 * SURGICAL ORTHOPEDICS
 */
export const ORTHO_SURGICAL_KNOWLEDGE: DomainKnowledge = {
  domain: 'orthopedics-surgical',
  concepts: [
    'Surgical approaches and techniques',
    'Fixation strategies and implants',
    'Graft selection and healing',
    'Surgical biomechanics and stability',
    'Perioperative complications',
    'Reconstruction vs repair decision-making',
  ],
  bestPractices: [
    'Compare techniques on alignment, stability, and outcomes',
    'Track complication, failure, and revision rates',
    'Differentiate technique efficacy by tissue quality',
    'Use standardized reporting of surgical techniques',
    'Assess biomechanical rationale for technique choice',
  ],
  commonPitfalls: [
    'Conflating technical success with long-term function',
    'Small sample sizes without adequate power',
    'Uncontrolled surgeon experience effects',
    'Unclear definitions of failure or re-injury',
  ],
  contextPrompt: `You are discussing orthopedic surgical research.

FOCUS ON:
- Technique-specific outcomes and failure modes
- Biomechanical rationale and fixation strategies
- Complication rates and revision burden

AVOID:
- Oversimplifying surgical technique comparisons
- Ignoring surgeon or center effects`,
};

/**
 * BIOMECHANICS
 */
export const BIOMECHANICS_KNOWLEDGE: DomainKnowledge = {
  domain: 'biomechanics',
  concepts: [
    'Load, strain, stress, and stiffness',
    'Material properties of tendon/ligament/cartilage',
    'Kinematics and kinetics (gait, joint moments)',
    'Failure thresholds and fatigue',
    'Viscoelasticity and time-dependent behavior',
  ],
  bestPractices: [
    'Define boundary conditions and loading protocols clearly',
    'Report strain rates and load magnitudes',
    'Distinguish in vitro vs in vivo relevance',
    'Use standardized biomechanical metrics for comparability',
  ],
  commonPitfalls: [
    'Overgeneralizing cadaveric data to clinical outcomes',
    'Unclear normalization of forces or moments',
    'Ignoring multi-axial loading in simplified models',
  ],
  contextPrompt: `You are analyzing orthopedic biomechanics.

FOCUS ON:
- Mechanical loading, failure thresholds, and material behavior
- Translational relevance to clinical outcomes
- Clear definitions of test setups and metrics

AVOID:
- Extrapolating biomechanical results beyond their context`,
};

/**
 * TISSUE BIOLOGY / REGENERATION
 */
export const TISSUE_BIOLOGY_KNOWLEDGE: DomainKnowledge = {
  domain: 'tissue-biology',
  concepts: [
    'Inflammatory and healing phases',
    'ECM remodeling and collagen organization',
    'Cellular actors: tenocytes, fibroblasts, macrophages',
    'Angiogenesis and vascularization',
    'Regenerative strategies (PRP, stem cells, scaffolds)',
  ],
  bestPractices: [
    'Separate short-term inflammatory effects from long-term remodeling',
    'Describe cellular and molecular markers explicitly',
    'Connect biological changes to mechanical outcomes',
    'Account for dosage, timing, and delivery method',
  ],
  commonPitfalls: [
    'Assuming biological markers imply functional improvement',
    'Insufficient longitudinal follow-up',
    'Overstating in vitro findings without translational evidence',
  ],
  contextPrompt: `You are discussing tissue biology and regeneration in orthopedics.

FOCUS ON:
- Healing timelines, cellular mechanisms, and ECM remodeling
- Linking biological signals to functional outcomes
- Experimental controls and dosage/timing effects

AVOID:
- Overclaiming efficacy without longitudinal data`,
};

/**
 * IMAGING
 */
export const IMAGING_KNOWLEDGE: DomainKnowledge = {
  domain: 'imaging',
  concepts: [
    'MRI sequence selection and sensitivity',
    'Ultrasound for dynamic assessment',
    'CT for bony architecture',
    'Radiographic grading systems',
    'Inter-observer reliability',
  ],
  bestPractices: [
    'Specify imaging protocols and sequences',
    'Report diagnostic performance metrics when available',
    'Use standardized grading systems',
    'Correlate imaging with clinical outcomes',
  ],
  commonPitfalls: [
    'Assuming imaging abnormality equals clinical significance',
    'Inconsistent imaging protocols across cohorts',
    'Ignoring observer variability',
  ],
  contextPrompt: `You are analyzing orthopedic imaging research.

FOCUS ON:
- Protocols, sequences, and diagnostic accuracy
- Reliability and correlation with outcomes

AVOID:
- Treating imaging findings as definitive without clinical context`,
};

/**
 * REHABILITATION
 */
export const REHAB_KNOWLEDGE: DomainKnowledge = {
  domain: 'rehabilitation',
  concepts: [
    'Loading protocols and progression',
    'Eccentric vs isometric strategies',
    'Return-to-activity criteria',
    'Neuromuscular control and proprioception',
  ],
  bestPractices: [
    'Define dosage and progression clearly',
    'Link rehab protocols to objective outcomes',
    'Account for adherence and supervision',
    'Separate short-term symptom relief from long-term adaptation',
  ],
  commonPitfalls: [
    'Underspecified protocols that cannot be replicated',
    'Mixing heterogeneous rehab programs in analysis',
    'Ignoring adherence and exposure dose',
  ],
  contextPrompt: `You are working within orthopedic rehabilitation research.

FOCUS ON:
- Protocol specificity, dosage, and progression
- Outcome measures and adherence

AVOID:
- Overgeneralizing across heterogeneous protocols`,
};

/**
 * MIXED DOMAIN KNOWLEDGE
 */
export const MIXED_DOMAIN_KNOWLEDGE: DomainKnowledge = {
  domain: 'orthopedics-clinical',
  concepts: [
    'Cross-domain integration (clinical + biomechanics + biology)',
    'Translational pathways from bench to clinic',
    'Study design across disciplines',
    'Evidence grading and synthesis',
  ],
  bestPractices: [
    'Explicitly connect mechanisms to clinical outcomes',
    'Separate evidence strength by domain',
    'Avoid overextending findings across contexts',
  ],
  commonPitfalls: [
    'Assuming mechanistic plausibility equals clinical efficacy',
    'Missing confounders at clinical boundaries',
  ],
  contextPrompt: `You are integrating multiple orthopedic research domains.

FOCUS ON:
- Translational consistency between evidence layers
- Clear separation of mechanistic evidence vs clinical outcomes

AVOID:
- Conflating domain-specific evidence quality`,
};

/**
 * Domain knowledge repository
 */
export const DOMAIN_KNOWLEDGE_BASE: Record<
  'orthopedics-clinical' | 'orthopedics-surgical' | 'biomechanics' | 'tissue-biology' | 'imaging' | 'rehabilitation' | 'mixed',
  DomainKnowledge
> = {
  'orthopedics-clinical': ORTHO_CLINICAL_KNOWLEDGE,
  'orthopedics-surgical': ORTHO_SURGICAL_KNOWLEDGE,
  'biomechanics': BIOMECHANICS_KNOWLEDGE,
  'tissue-biology': TISSUE_BIOLOGY_KNOWLEDGE,
  'imaging': IMAGING_KNOWLEDGE,
  'rehabilitation': REHAB_KNOWLEDGE,
  'mixed': MIXED_DOMAIN_KNOWLEDGE,
};

/**
 * Get domain knowledge by type
 */
export function getDomainKnowledge(
  domain: 'orthopedics-clinical' | 'orthopedics-surgical' | 'biomechanics' | 'tissue-biology' | 'imaging' | 'rehabilitation' | 'mixed'
): DomainKnowledge {
  return DOMAIN_KNOWLEDGE_BASE[domain];
}

/**
 * Get context prompt for a domain
 */
export function getDomainContextPrompt(
  domain: 'orthopedics-clinical' | 'orthopedics-surgical' | 'biomechanics' | 'tissue-biology' | 'imaging' | 'rehabilitation' | 'mixed'
): string {
  return getDomainKnowledge(domain).contextPrompt;
}

/**
 * Format domain knowledge for injection into system prompt
 */
export function formatDomainKnowledge(domain: Domain): string | null {
  if (!domain) return null;

  const knowledge = getDomainKnowledge(domain);

  return `
DOMAIN CONTEXT: ${domain.replace('-', ' ').toUpperCase()}

Key Concepts:
${knowledge.concepts.map(c => `• ${c}`).join('\n')}

Best Practices:
${knowledge.bestPractices.slice(0, 5).map(p => `• ${p}`).join('\n')}

Common Pitfalls to Avoid:
${knowledge.commonPitfalls.slice(0, 5).map(p => `• ${p}`).join('\n')}

${knowledge.contextPrompt}
`;
}
