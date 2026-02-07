import type {
  ClinicalReferenceCategory,
  GuidelineTemplate,
  KnowledgeSourceCategory,
  KnowledgeSourceType,
} from './phase5Types';

export interface KnowledgeSourceSeed {
  source_key: string;
  name: string;
  authority: string;
  category: KnowledgeSourceCategory;
  source_type: KnowledgeSourceType;
  endpoint?: string;
}

export const DEFAULT_KNOWLEDGE_SOURCES: KnowledgeSourceSeed[] = [
  {
    source_key: 'aaos_cpg',
    name: 'AAOS Clinical Practice Guidelines',
    authority: 'American Academy of Orthopaedic Surgeons',
    category: 'guideline',
    source_type: 'aaos',
    endpoint: 'https://www.aaos.org/quality/quality-programs/clinical-practice-guidelines/',
  },
  {
    source_key: 'ao_fracture',
    name: 'AO Foundation Fracture Management',
    authority: 'AO Foundation',
    category: 'guideline',
    source_type: 'ao',
    endpoint: 'https://surgeryreference.aofoundation.org/orthopedic-trauma',
  },
  {
    source_key: 'acsm_exercise',
    name: 'ACSM Exercise Prescription Guidance',
    authority: 'American College of Sports Medicine',
    category: 'guideline',
    source_type: 'acsm',
    endpoint: 'https://www.acsm.org/',
  },
  {
    source_key: 'pt_protocols',
    name: 'Physical Therapy Protocol Library',
    authority: 'Local Protocol Repository',
    category: 'guideline',
    source_type: 'pt',
  },
  {
    source_key: 'surgical_atlases',
    name: 'Surgical Approach Atlas Index',
    authority: 'Local Surgical Atlas Repository',
    category: 'guideline',
    source_type: 'atlas',
  },
  {
    source_key: 'pubmed',
    name: 'PubMed Evidence Feed',
    authority: 'U.S. National Library of Medicine',
    category: 'evidence',
    source_type: 'pubmed',
    endpoint: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/',
  },
  {
    source_key: 'cochrane',
    name: 'Cochrane Evidence Feed',
    authority: 'Cochrane Collaboration',
    category: 'evidence',
    source_type: 'cochrane',
  },
];

export const DEFAULT_GUIDELINE_TEMPLATES: GuidelineTemplate[] = [
  {
    guidelineKey: 'aaos_cpg',
    title: 'AAOS Guideline Integration Framework',
    source: 'AAOS CPG',
    version: 'framework-2026.1',
    subspecialty: 'general orthopedics',
    diagnosisTags: ['guideline', 'evidence', 'shared-decision-making'],
    content: `
Use AAOS CPG content with this structure:
1. Recommendation statement.
2. Strength of recommendation.
3. Evidence summary and major caveats.
4. Orthopedic subgroup applicability (age, activity, comorbidity).
5. Implementation notes and contraindications.

When content is missing or outdated, flag the gap and request guideline-specific update sync.
    `.trim(),
  },
  {
    guidelineKey: 'ao_fracture',
    title: 'AO Fracture Classification and Treatment Framework',
    source: 'AO Foundation',
    version: 'framework-2026.1',
    subspecialty: 'trauma',
    diagnosisTags: ['fracture', 'classification', 'fixation'],
    content: `
Use AO fracture logic with this order:
1. Fracture pattern and classification branch.
2. Stability and soft tissue status assessment.
3. Non-operative vs operative pathway with clear thresholds.
4. Fixation principles and post-op weight-bearing progression.
5. Complication surveillance points.

Reference formal AO tables when available in local ingested documents.
    `.trim(),
  },
  {
    guidelineKey: 'acsm_exercise',
    title: 'ACSM Exercise Prescription Framework',
    source: 'ACSM',
    version: 'framework-2026.1',
    subspecialty: 'sports medicine',
    diagnosisTags: ['exercise', 'rehab', 'conditioning'],
    content: `
For exercise guidance, structure recommendations as:
1. Baseline status and contraindication screen.
2. FITT principle dosing.
3. Progression triggers and stopping criteria.
4. Return-to-activity milestones.
5. Outcome tracking metrics.

Prioritize orthopedic constraints (pain, ROM, load tolerance, tissue healing timeline).
    `.trim(),
  },
  {
    guidelineKey: 'pt_protocols',
    title: 'Physical Therapy Protocol Integration Framework',
    source: 'PT Protocol Database',
    version: 'framework-2026.1',
    subspecialty: 'rehab',
    diagnosisTags: ['physical-therapy', 'protocol', 'rehabilitation'],
    content: `
Protocol ingestion standard:
1. Phase-based rehab objectives.
2. Allowed and restricted movements by phase.
3. Advancement criteria.
4. Regression criteria and red flags.
5. Return-to-work or return-to-sport checkpoints.

Map protocols to diagnosis tags and surgical procedure tags.
    `.trim(),
  },
  {
    guidelineKey: 'surgical_atlases',
    title: 'Surgical Approach Atlas Integration Framework',
    source: 'Surgical Atlas',
    version: 'framework-2026.1',
    subspecialty: 'surgical planning',
    diagnosisTags: ['approach', 'surgical-planning', 'anatomy'],
    content: `
Approach atlas indexing format:
1. Indications and contraindications.
2. Patient positioning and landmarks.
3. Critical neurovascular structures at risk.
4. Exposure steps and extension options.
5. Closure strategy and post-op pathway.

Always align approach selection with patient-specific anatomy and risk profile.
    `.trim(),
  },
];

export interface ClinicalReferenceSeed {
  category: ClinicalReferenceCategory;
  name: string;
  summary: string;
  indications: string;
  contraindications: string;
  source: string;
  version: string;
  metadata?: Record<string, unknown>;
}

export const DEFAULT_REFERENCE_ITEMS: ClinicalReferenceSeed[] = [
  {
    category: 'implant',
    name: 'Total Hip Arthroplasty System Selection Checklist',
    summary: 'Framework for selecting femoral stem fixation, acetabular shell design, and bearing surface.',
    indications: 'End-stage hip arthritis, femoral neck fracture arthroplasty candidates.',
    contraindications: 'Uncontrolled infection, inadequate bone stock without augmentation strategy.',
    source: 'OrthoAI Device Knowledge Base',
    version: '2026.1',
    metadata: { joints: ['hip'], implantFamilies: ['cemented', 'cementless', 'dual-mobility'] },
  },
  {
    category: 'implant',
    name: 'Total Knee Arthroplasty Constraint Selection Guide',
    summary: 'Guides implant constraint choice based on collateral competence, deformity severity, and revision context.',
    indications: 'Primary and revision TKA planning.',
    contraindications: 'None absolute; requires biomechanical mismatch review.',
    source: 'OrthoAI Device Knowledge Base',
    version: '2026.1',
    metadata: { joints: ['knee'], implantFamilies: ['cr', 'ps', 'vc', 'hinged'] },
  },
  {
    category: 'implant',
    name: 'Shoulder Arthroplasty Platform Selection Guide',
    summary: 'Decision pathway for anatomic vs reverse shoulder systems using cuff status and glenoid morphology.',
    indications: 'Glenohumeral arthritis and cuff arthropathy cases.',
    contraindications: 'Active infection, unresolved nerve palsy without surgical plan.',
    source: 'OrthoAI Device Knowledge Base',
    version: '2026.1',
    metadata: { joints: ['shoulder'], implantFamilies: ['anatomic', 'reverse'] },
  },
  {
    category: 'medication_protocol',
    name: 'Orthopedic Multimodal Analgesia Protocol',
    summary: 'Perioperative analgesia protocol combining acetaminophen, NSAID, and opioid-sparing rescue dosing.',
    indications: 'Postoperative pain control after elective orthopedic procedures.',
    contraindications: 'Renal failure, GI bleed risk, opioid intolerance without alternatives.',
    source: 'Local Pharmacy Protocol',
    version: '2026.1',
    metadata: { classes: ['acetaminophen', 'NSAID', 'opioid'] },
  },
  {
    category: 'medication_protocol',
    name: 'Perioperative Orthopedic Antibiotic Prophylaxis Framework',
    summary: 'Pre-incision timing, redosing windows, and allergy-pathway substitutions.',
    indications: 'Clean orthopedic cases and implant surgery.',
    contraindications: 'Drug-specific allergy or severe prior reaction.',
    source: 'Local Pharmacy Protocol',
    version: '2026.1',
    metadata: { classes: ['cefazolin', 'vancomycin', 'clindamycin'] },
  },
  {
    category: 'medication_protocol',
    name: 'VTE Prophylaxis Selection Framework',
    summary: 'Framework balancing thrombosis risk, bleeding risk, and mobilization strategy.',
    indications: 'Post-op arthroplasty, trauma, and prolonged immobility.',
    contraindications: 'Active bleeding, high-risk neuraxial timing conflicts.',
    source: 'Local Pharmacy Protocol',
    version: '2026.1',
    metadata: { classes: ['aspirin', 'LMWH', 'DOAC'] },
  },
  {
    category: 'injection_technique',
    name: 'Ultrasound-Guided Subacromial Corticosteroid Injection',
    summary: 'Technique checklist, medication options, and follow-up monitoring points.',
    indications: 'Subacromial bursitis, impingement symptoms refractory to initial conservative care.',
    contraindications: 'Local infection, uncontrolled diabetes without monitoring plan.',
    source: 'Local Procedure Protocol',
    version: '2026.1',
    metadata: { target: 'shoulder', injectates: ['corticosteroid', 'local anesthetic'] },
  },
  {
    category: 'injection_technique',
    name: 'Knee Viscosupplementation Injection Framework',
    summary: 'Selection criteria, contraindications, and timing expectations for symptom response.',
    indications: 'Symptomatic knee OA after failed first-line conservative treatment.',
    contraindications: 'Joint infection, inflammatory flare requiring alternate workup.',
    source: 'Local Procedure Protocol',
    version: '2026.1',
    metadata: { target: 'knee', injectates: ['hyaluronic acid'] },
  },
  {
    category: 'injection_technique',
    name: 'PRP Tendinopathy Injection Preparation Checklist',
    summary: 'Pre-injection meds hold, leukocyte concentration considerations, and rehab sequencing.',
    indications: 'Chronic tendinopathy with structured rehab plateau.',
    contraindications: 'Coagulopathy, active infection, unrealistic activity expectations.',
    source: 'Local Procedure Protocol',
    version: '2026.1',
    metadata: { target: 'tendon', injectates: ['PRP'] },
  },
  {
    category: 'dme_bracing',
    name: 'Post-op Knee Brace Selection Matrix',
    summary: 'Maps procedure class to brace type, ROM settings, and progression schedule.',
    indications: 'Ligament reconstruction, osteotomy, selected fracture fixation.',
    contraindications: 'Poor fit tolerance requiring custom orthotics.',
    source: 'Orthotics Protocol',
    version: '2026.1',
    metadata: { region: 'knee' },
  },
  {
    category: 'dme_bracing',
    name: 'Ankle-Foot Orthosis Recommendation Guide',
    summary: 'Selects AFO type by weakness pattern, spasticity, and gait goals.',
    indications: 'Foot drop, chronic ankle instability, neuromuscular deficits.',
    contraindications: 'Skin compromise at contact points without offloading strategy.',
    source: 'Orthotics Protocol',
    version: '2026.1',
    metadata: { region: 'ankle-foot' },
  },
  {
    category: 'dme_bracing',
    name: 'Spine Brace Use Framework',
    summary: 'Framework for thoracolumbar and cervical brace indication, wear schedule, and weaning.',
    indications: 'Stable compression fractures, selected post-op stabilization plans.',
    contraindications: 'Unstable injury requiring operative stabilization.',
    source: 'Orthotics Protocol',
    version: '2026.1',
    metadata: { region: 'spine' },
  },
];
