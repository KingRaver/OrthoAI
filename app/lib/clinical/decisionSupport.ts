import type { CaseEvent, PatientCase } from '@/app/lib/cases/types';

export type RiskLevel = 'low' | 'moderate' | 'high' | 'critical';

export interface FlowchartNode {
  id: string;
  label: string;
  kind: 'start' | 'question' | 'decision' | 'action' | 'outcome';
}

export interface FlowchartEdge {
  from: string;
  to: string;
  condition?: string;
}

export interface RedFlagAlert {
  id: string;
  title: string;
  severity: RiskLevel;
  reason: string;
  action: string;
}

export interface DifferentialDiagnosis {
  diagnosis: string;
  likelihood: number; // 0..1
  rationale: string;
  supportingFindings: string[];
}

export interface WorkupRecommendation {
  immediateActions: string[];
  imaging: string[];
  labs: string[];
  consults: string[];
  rationale: string;
}

export interface DecisionTreeNode {
  id: string;
  prompt: string;
  yes?: string;
  no?: string;
  outcome?: string;
}

export interface SurgicalApproachOption {
  approach: string;
  pros: string[];
  cons: string[];
  indications: string[];
  contraindications: string[];
}

export interface PreopChecklist {
  medicalOptimization: string[];
  imagingAndPlanning: string[];
  implantAndEquipment: string[];
  patientCounseling: string[];
}

export interface TimelineMilestone {
  week: number;
  target: string;
  criteria: string[];
}

export interface ComplicationRiskResult {
  score: number;
  level: RiskLevel;
  contributors: Array<{ factor: string; points: number }>;
  mitigationPlan: string[];
}

export interface ComparativeEffectivenessResult {
  options: Array<{
    name: string;
    expectedPainImprovement: number;
    expectedFunctionImprovement: number;
    revisionRisk: number;
    returnToActivityWeeks: number;
  }>;
  bestOption: string;
}

export interface CaseDashboardSnapshot {
  overview: {
    caseId: string;
    title: string;
    status: string;
    timelineDays: number;
    totalEvents: number;
    keyMetrics: Array<{ label: string; value: string | number }>;
  };
  treatmentProgress: Array<{
    phase: string;
    completed: boolean;
    completedAt?: string;
  }>;
  outcomeTrends: Array<{
    date: string;
    metric: string;
    value: number;
  }>;
  alerts: Array<{
    level: RiskLevel;
    message: string;
  }>;
}

type ClinicalInput = {
  complaint: string;
  history?: string;
  examFindings?: string[];
  age?: number;
  comorbidities?: string[];
  activityGoal?: string;
  procedure?: string;
  daysSinceInjury?: number;
};

function normalizeText(input: string): string {
  return input.toLowerCase();
}

function containsAny(text: string, terms: string[]): boolean {
  return terms.some(term => text.includes(term));
}

export function generateSymptomFlowchart(complaint: string): {
  nodes: FlowchartNode[];
  edges: FlowchartEdge[];
} {
  const text = normalizeText(complaint);

  if (containsAny(text, ['knee', 'acl', 'meniscus', 'patella'])) {
    return {
      nodes: [
        { id: 'start', label: 'Knee pain/swelling presentation', kind: 'start' },
        { id: 'trauma', label: 'Recent trauma or pivot injury?', kind: 'question' },
        { id: 'instability', label: 'Instability/giving way?', kind: 'question' },
        { id: 'locking', label: 'Mechanical locking/catching?', kind: 'question' },
        { id: 'xray', label: 'Order knee radiographs', kind: 'action' },
        { id: 'mri', label: 'Order MRI for ligament/meniscus', kind: 'action' },
        { id: 'conservative', label: 'Conservative pathway', kind: 'outcome' },
        { id: 'surgical', label: 'Surgical consult pathway', kind: 'outcome' },
      ],
      edges: [
        { from: 'start', to: 'trauma' },
        { from: 'trauma', to: 'xray', condition: 'yes' },
        { from: 'trauma', to: 'conservative', condition: 'no' },
        { from: 'xray', to: 'instability' },
        { from: 'instability', to: 'mri', condition: 'yes' },
        { from: 'instability', to: 'locking', condition: 'no' },
        { from: 'locking', to: 'surgical', condition: 'yes' },
        { from: 'locking', to: 'conservative', condition: 'no' },
        { from: 'mri', to: 'surgical' },
      ],
    };
  }

  if (containsAny(text, ['back', 'lumbar', 'radicular', 'sciatica'])) {
    return {
      nodes: [
        { id: 'start', label: 'Spine/back pain presentation', kind: 'start' },
        { id: 'redflags', label: 'Any neurologic or systemic red flags?', kind: 'question' },
        { id: 'urgent', label: 'Urgent MRI + specialist referral', kind: 'action' },
        { id: 'conservative', label: 'Conservative management 4-6 weeks', kind: 'action' },
        { id: 'reassess', label: 'Persistent deficits or refractory pain?', kind: 'question' },
        { id: 'elective', label: 'Elective advanced imaging/intervention planning', kind: 'outcome' },
      ],
      edges: [
        { from: 'start', to: 'redflags' },
        { from: 'redflags', to: 'urgent', condition: 'yes' },
        { from: 'redflags', to: 'conservative', condition: 'no' },
        { from: 'conservative', to: 'reassess' },
        { from: 'reassess', to: 'elective', condition: 'yes' },
      ],
    };
  }

  return {
    nodes: [
      { id: 'start', label: 'Initial orthopedic presentation', kind: 'start' },
      { id: 'severity', label: 'Assess severity and neurovascular status', kind: 'question' },
      { id: 'imaging', label: 'Select targeted imaging/labs', kind: 'action' },
      { id: 'plan', label: 'Choose conservative vs procedural plan', kind: 'decision' },
      { id: 'followup', label: 'Set follow-up milestones', kind: 'outcome' },
    ],
    edges: [
      { from: 'start', to: 'severity' },
      { from: 'severity', to: 'imaging' },
      { from: 'imaging', to: 'plan' },
      { from: 'plan', to: 'followup' },
    ],
  };
}

export function getPhysicalExamGuidance(complaint: string): string[] {
  const text = normalizeText(complaint);
  if (containsAny(text, ['shoulder', 'rotator cuff', 'labrum'])) {
    return [
      'Inspect asymmetry, scapular dyskinesis, and atrophy patterns',
      'Assess active/passive ROM with painful arc documentation',
      'Test supraspinatus/infraspinatus/subscapularis strength',
      'Perform Neer/Hawkins and biceps-labral provocative maneuvers',
      'Document neurovascular status and cervical contribution',
    ];
  }

  if (containsAny(text, ['knee', 'acl', 'meniscus'])) {
    return [
      'Assess gait, effusion, and extensor mechanism integrity',
      'Measure ROM and terminal extension deficit',
      'Perform Lachman/anterior drawer/pivot shift if tolerated',
      'Perform McMurray/Thessaly for meniscal pathology',
      'Assess collateral laxity and distal neurovascular exam',
    ];
  }

  return [
    'Inspect deformity, swelling, and skin compromise',
    'Measure active and passive range of motion',
    'Assess focal tenderness and strength deficits',
    'Perform condition-specific provocative tests',
    'Document neurovascular status and red-flag findings',
  ];
}

export function detectRedFlags(input: ClinicalInput): RedFlagAlert[] {
  const corpus = normalizeText([
    input.complaint,
    input.history || '',
    ...(input.examFindings || []),
  ].join(' '));

  const alerts: RedFlagAlert[] = [];

  if (containsAny(corpus, ['cauda equina', 'saddle anesthesia', 'urinary retention'])) {
    alerts.push({
      id: 'rf-cauda-equina',
      title: 'Possible cauda equina syndrome',
      severity: 'critical',
      reason: 'Neurologic compression symptoms with bowel/bladder concern.',
      action: 'Immediate ED transfer and urgent spine MRI/neurosurgical consult.',
    });
  }

  if (containsAny(corpus, ['fever', 'septic', 'hot joint', 'erythema']) && containsAny(corpus, ['joint', 'knee', 'hip', 'shoulder'])) {
    alerts.push({
      id: 'rf-septic-joint',
      title: 'Possible septic joint',
      severity: 'critical',
      reason: 'Inflammatory joint symptoms with infectious features.',
      action: 'Urgent arthrocentesis, labs, antibiotics after cultures, specialist escalation.',
    });
  }

  if (containsAny(corpus, ['compartment', 'pain out of proportion', 'tense compartment'])) {
    alerts.push({
      id: 'rf-compartment',
      title: 'Possible compartment syndrome',
      severity: 'critical',
      reason: 'Ischemic risk from elevated compartment pressure.',
      action: 'Immediate surgical evaluation and pressure assessment.',
    });
  }

  if (containsAny(corpus, ['numbness', 'weakness', 'foot drop', 'neurovascular'])) {
    alerts.push({
      id: 'rf-neurovascular',
      title: 'Neurovascular compromise concern',
      severity: 'high',
      reason: 'Potential progressive neurologic or perfusion injury.',
      action: 'Urgent neurovascular reassessment and expedited imaging/referral.',
    });
  }

  return alerts;
}

export function rankDifferentialDiagnoses(input: ClinicalInput): DifferentialDiagnosis[] {
  const text = normalizeText([input.complaint, input.history || '', ...(input.examFindings || [])].join(' '));
  const candidates: DifferentialDiagnosis[] = [];

  if (containsAny(text, ['knee', 'pivot', 'instability', 'acl'])) {
    candidates.push({
      diagnosis: 'ACL rupture',
      likelihood: 0.78,
      rationale: 'Pivot/instability pattern with traumatic knee presentation.',
      supportingFindings: ['Pivot injury', 'Instability', 'Positive Lachman/pivot shift'],
    });
    candidates.push({
      diagnosis: 'Meniscal tear',
      likelihood: 0.64,
      rationale: 'Mechanical symptoms and joint-line loading concern.',
      supportingFindings: ['Locking/catching', 'Joint-line tenderness'],
    });
  }

  if (containsAny(text, ['shoulder', 'overhead', 'weakness', 'cuff'])) {
    candidates.push({
      diagnosis: 'Rotator cuff tear',
      likelihood: 0.72,
      rationale: 'Painful arc and weakness with overhead activity profile.',
      supportingFindings: ['Painful arc', 'External rotation weakness'],
    });
    candidates.push({
      diagnosis: 'Subacromial impingement',
      likelihood: 0.58,
      rationale: 'Classic impingement provocative features.',
      supportingFindings: ['Neer/Hawkins positive'],
    });
  }

  if (containsAny(text, ['back', 'radicular', 'leg pain', 'sciatica'])) {
    candidates.push({
      diagnosis: 'Lumbar disc herniation with radiculopathy',
      likelihood: 0.74,
      rationale: 'Radiating pain pattern with neurologic irritation symptoms.',
      supportingFindings: ['Radicular pain', 'Positive tension signs'],
    });
    candidates.push({
      diagnosis: 'Lumbar stenosis',
      likelihood: 0.41,
      rationale: 'Neurogenic claudication differential when activity-related.',
      supportingFindings: ['Walking intolerance', 'Relief with flexion'],
    });
  }

  if (candidates.length === 0) {
    candidates.push({
      diagnosis: 'Mechanical musculoskeletal pain',
      likelihood: 0.52,
      rationale: 'Non-specific orthopedic pattern without high-risk features.',
      supportingFindings: ['Localized pain', 'Activity related symptoms'],
    });
  }

  return candidates
    .sort((a, b) => b.likelihood - a.likelihood)
    .map((item, index) => ({
      ...item,
      likelihood: Math.max(0.1, Math.min(0.95, item.likelihood - index * 0.04)),
    }));
}

export function recommendWorkup(input: ClinicalInput, differentials: DifferentialDiagnosis[], redFlags: RedFlagAlert[]): WorkupRecommendation {
  const complaint = normalizeText(input.complaint);
  const immediateActions: string[] = [];
  const imaging = ['Targeted plain radiographs of affected region'];
  const labs: string[] = [];
  const consults: string[] = [];

  if (redFlags.length > 0) {
    immediateActions.push('Escalate urgent care pathway based on detected red flags');
  }

  if (containsAny(complaint, ['knee', 'shoulder', 'ligament', 'meniscus', 'cuff'])) {
    imaging.push('MRI for soft-tissue characterization if exam suggests internal derangement');
  }
  if (containsAny(complaint, ['back', 'radicular', 'spine'])) {
    imaging.push('Lumbar MRI if progressive deficit, red flags, or persistent refractory symptoms');
  }
  if (containsAny(complaint, ['infection', 'fever', 'septic'])) {
    labs.push('CBC, CRP, ESR');
    labs.push('Blood cultures and aspiration studies when indicated');
  }

  if (differentials.some(item => item.likelihood >= 0.7)) {
    consults.push('Early orthopedic subspecialty consultation');
  }
  if (redFlags.some(item => item.severity === 'critical')) {
    consults.push('Urgent emergency/surgical consultation');
  }

  return {
    immediateActions,
    imaging,
    labs,
    consults,
    rationale: 'Workup prioritized by red-flag risk and top differential probabilities.',
  };
}

export function buildTreatmentDecisionTree(input: ClinicalInput): DecisionTreeNode[] {
  return [
    {
      id: 'dt1',
      prompt: 'Red flags or unstable injury pattern present?',
      yes: 'dt2',
      no: 'dt3',
    },
    {
      id: 'dt2',
      prompt: 'Expedited surgical/emergent pathway',
      outcome: 'Urgent operative/specialist management track',
    },
    {
      id: 'dt3',
      prompt: 'Has structured conservative care failed after 6-12 weeks?',
      yes: 'dt4',
      no: 'dt5',
    },
    {
      id: 'dt4',
      prompt: 'Assess patient goals/comorbidity risk tradeoff',
      outcome: `Discuss procedural options aligned to ${input.activityGoal || 'functional'} goals`,
    },
    {
      id: 'dt5',
      prompt: 'Continue conservative pathway',
      outcome: 'Rehab progression, pain optimization, and milestone reassessment',
    },
  ];
}

export function compareSurgicalApproaches(condition: string): SurgicalApproachOption[] {
  const text = normalizeText(condition);
  if (containsAny(text, ['acl'])) {
    return [
      {
        approach: 'Arthroscopic ACL reconstruction (autograft)',
        pros: ['Strong graft incorporation', 'Lower rerupture in high-demand athletes'],
        cons: ['Harvest-site morbidity', 'Longer early rehab burden'],
        indications: ['Young active patient', 'Instability with pivoting sports'],
        contraindications: ['Poor rehab adherence', 'Active infection'],
      },
      {
        approach: 'Arthroscopic ACL reconstruction (allograft)',
        pros: ['Shorter operative time', 'No donor-site morbidity'],
        cons: ['Potentially higher failure in young athletes'],
        indications: ['Older/less pivot-demand patients', 'Revision contexts'],
        contraindications: ['Very high-demand young athlete profile'],
      },
    ];
  }

  return [
    {
      approach: 'Minimally invasive approach',
      pros: ['Lower soft-tissue disruption', 'Potentially faster early recovery'],
      cons: ['Technically demanding exposure'],
      indications: ['Focal pathology with clear target'],
      contraindications: ['Complex multi-planar deformity needing broad access'],
    },
    {
      approach: 'Open approach',
      pros: ['Broad exposure', 'Flexible intraoperative decision making'],
      cons: ['Higher soft-tissue burden'],
      indications: ['Complex reconstruction or revision setting'],
      contraindications: ['None absolute; weigh patient-specific risk'],
    },
  ];
}

export function generatePreopChecklist(procedure: string, comorbidities: string[] = []): PreopChecklist {
  const hasDiabetes = comorbidities.some(item => normalizeText(item).includes('diabet'));
  const hasSmoking = comorbidities.some(item => normalizeText(item).includes('smok'));

  return {
    medicalOptimization: [
      'Medication reconciliation and anticoagulation plan',
      hasDiabetes ? 'Optimize perioperative glycemic control' : 'Confirm metabolic optimization',
      hasSmoking ? 'Initiate smoking cessation protocol' : 'Assess wound-healing risk profile',
    ],
    imagingAndPlanning: [
      'Verify latest imaging and templating',
      `Confirm procedure plan: ${procedure || 'orthopedic intervention'}`,
      'Review backup strategy for fixation/implant alternatives',
    ],
    implantAndEquipment: [
      'Confirm implant set availability and backup sizes',
      'Confirm navigation/arthroscopy/fluoro requirements',
      'Assign blood management plan if expected blood loss risk',
    ],
    patientCounseling: [
      'Review expected outcome, alternatives, and major complication profile',
      'Document informed consent and rehabilitation timeline expectations',
      'Set postoperative follow-up and red-flag escalation instructions',
    ],
  };
}

export function buildRecoveryTimeline(procedure: string): TimelineMilestone[] {
  const text = normalizeText(procedure);
  if (containsAny(text, ['acl', 'ligament'])) {
    return [
      { week: 2, target: 'Pain/effusion control and extension restoration', criteria: ['Near full extension', 'Protected weight bearing as indicated'] },
      { week: 6, target: 'Strength and neuromuscular control foundation', criteria: ['Quadriceps activation', 'Progressive closed-chain strength'] },
      { week: 12, target: 'Advanced functional strengthening', criteria: ['Symmetric movement quality', 'No reactive swelling'] },
      { week: 24, target: 'Return-to-sport testing', criteria: ['Pass functional battery', 'Psychological readiness assessed'] },
    ];
  }

  return [
    { week: 2, target: 'Acute recovery and symptom control', criteria: ['Pain trending down', 'Safe mobility pattern'] },
    { week: 6, target: 'Early strength and mobility progression', criteria: ['ROM progression', 'Tolerating rehab load'] },
    { week: 12, target: 'Functional activity restoration', criteria: ['Improved endurance and strength', 'Stable symptom response'] },
    { week: 24, target: 'Higher-demand activity transition', criteria: ['Milestones achieved', 'No major setbacks'] },
  ];
}

export function stratifyComplicationRisk(input: ClinicalInput): ComplicationRiskResult {
  const contributors: Array<{ factor: string; points: number }> = [];
  let score = 0;

  if ((input.age || 0) >= 65) {
    score += 2;
    contributors.push({ factor: 'Age >= 65', points: 2 });
  }

  for (const comorbidity of input.comorbidities || []) {
    const normalized = normalizeText(comorbidity);
    if (containsAny(normalized, ['diabet', 'renal', 'immun', 'vascular'])) {
      score += 2;
      contributors.push({ factor: `Comorbidity: ${comorbidity}`, points: 2 });
    } else {
      score += 1;
      contributors.push({ factor: `Comorbidity: ${comorbidity}`, points: 1 });
    }
  }

  if ((input.daysSinceInjury || 0) > 42) {
    score += 1;
    contributors.push({ factor: 'Delayed presentation > 6 weeks', points: 1 });
  }

  const level: RiskLevel =
    score >= 7 ? 'high' :
    score >= 4 ? 'moderate' :
    'low';

  return {
    score,
    level,
    contributors,
    mitigationPlan: [
      'Prehabilitation and nutritional optimization',
      'Comorbidity-specific perioperative protocol',
      'Close follow-up for infection, thromboembolic, and stiffness surveillance',
    ],
  };
}

export function calculateWomac(values: number[]): { total: number; normalized: number } {
  const maxScore = 96;
  const total = values.reduce((sum, value) => sum + Math.max(0, Math.min(4, value)), 0);
  const normalized = Math.round((1 - total / maxScore) * 1000) / 10;
  return { total, normalized };
}

export function calculateKoos(subscales: {
  pain: number;
  symptoms: number;
  adl: number;
  sport: number;
  qol: number;
}): { average: number } {
  const values = [subscales.pain, subscales.symptoms, subscales.adl, subscales.sport, subscales.qol]
    .map(value => Math.max(0, Math.min(100, value)));
  return {
    average: Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10,
  };
}

export function calculateOdi(values: number[]): { total: number; percentDisability: number } {
  const maxScore = 50;
  const total = values.reduce((sum, value) => sum + Math.max(0, Math.min(5, value)), 0);
  return {
    total,
    percentDisability: Math.round((total / maxScore) * 1000) / 10,
  };
}

export function predictSurgicalOutcome(input: ClinicalInput): {
  probabilityGoodOutcome: number;
  rationale: string;
} {
  const risk = stratifyComplicationRisk(input);
  const base = 0.82;
  const adjusted = Math.max(0.2, Math.min(0.95, base - risk.score * 0.05));
  return {
    probabilityGoodOutcome: Math.round(adjusted * 1000) / 1000,
    rationale: `Estimated from risk score ${risk.score} (${risk.level}) and baseline orthopedic outcome prior.`,
  };
}

export function estimateReturnTimeline(input: ClinicalInput): {
  returnToWorkWeeks: number;
  returnToSportWeeks: number;
} {
  const risk = stratifyComplicationRisk(input);
  const baseWork = 6;
  const baseSport = 16;
  const multiplier = risk.level === 'high' ? 1.7 : risk.level === 'moderate' ? 1.3 : 1.0;
  return {
    returnToWorkWeeks: Math.round(baseWork * multiplier),
    returnToSportWeeks: Math.round(baseSport * multiplier),
  };
}

export function compareEffectiveness(input: ClinicalInput): ComparativeEffectivenessResult {
  const risk = stratifyComplicationRisk(input);
  const conservative = {
    name: 'Conservative management',
    expectedPainImprovement: risk.level === 'high' ? 0.45 : 0.55,
    expectedFunctionImprovement: risk.level === 'high' ? 0.4 : 0.5,
    revisionRisk: 0.08,
    returnToActivityWeeks: 10,
  };
  const surgical = {
    name: 'Surgical management',
    expectedPainImprovement: risk.level === 'high' ? 0.62 : 0.72,
    expectedFunctionImprovement: risk.level === 'high' ? 0.58 : 0.7,
    revisionRisk: risk.level === 'high' ? 0.18 : 0.12,
    returnToActivityWeeks: risk.level === 'high' ? 24 : 18,
  };
  const bestOption =
    surgical.expectedFunctionImprovement - surgical.revisionRisk >
    conservative.expectedFunctionImprovement - conservative.revisionRisk
      ? surgical.name
      : conservative.name;

  return {
    options: [conservative, surgical],
    bestOption,
  };
}

function extractOutcomeTrends(events: CaseEvent[]): Array<{ date: string; metric: string; value: number }> {
  const trends: Array<{ date: string; metric: string; value: number }> = [];
  for (const event of events) {
    const details = event.details || {};
    const measureValue = details['value'];
    const measureName = details['measure'];
    if (typeof measureValue === 'number' && typeof measureName === 'string') {
      trends.push({
        date: event.occurred_at || event.created_at,
        metric: measureName,
        value: measureValue,
      });
    }
  }
  return trends.sort((a, b) => a.date.localeCompare(b.date));
}

function hasEventType(events: CaseEvent[], eventType: string): { completed: boolean; completedAt?: string } {
  const event = events.find(item => normalizeText(item.event_type) === normalizeText(eventType));
  if (!event) return { completed: false };
  return { completed: true, completedAt: event.occurred_at || event.created_at };
}

export function buildCaseDashboard(caseData: PatientCase, events: CaseEvent[]): CaseDashboardSnapshot {
  const createdAt = new Date(caseData.created_at).getTime();
  const updatedAt = new Date(caseData.updated_at).getTime();
  const timelineDays = Math.max(1, Math.round((updatedAt - createdAt) / (1000 * 60 * 60 * 24)));

  const trends = extractOutcomeTrends(events);
  const alerts: Array<{ level: RiskLevel; message: string }> = [];

  if (events.length === 0) {
    alerts.push({
      level: 'moderate',
      message: 'No timeline events documented yet.',
    });
  }

  const latestTrend = trends[trends.length - 1];
  const earliestTrend = trends[0];
  if (latestTrend && earliestTrend && latestTrend.value < earliestTrend.value) {
    alerts.push({
      level: 'high',
      message: `Latest ${latestTrend.metric} trend declined (${earliestTrend.value} -> ${latestTrend.value}).`,
    });
  }

  if (caseData.status === 'active' && timelineDays > 90 && !events.some(event => normalizeText(event.event_type).includes('follow'))) {
    alerts.push({
      level: 'moderate',
      message: 'Case active > 90 days without recent follow-up milestone.',
    });
  }

  return {
    overview: {
      caseId: caseData.id,
      title: caseData.title,
      status: caseData.status,
      timelineDays,
      totalEvents: events.length,
      keyMetrics: [
        { label: 'Total Events', value: events.length },
        { label: 'Timeline Days', value: timelineDays },
        { label: 'Latest Outcome Entry', value: trends.length > 0 ? trends[trends.length - 1].date : 'None' },
      ],
    },
    treatmentProgress: [
      { phase: 'Initial Assessment', ...hasEventType(events, 'consultation') },
      { phase: 'Imaging Workup', ...hasEventType(events, 'imaging') },
      { phase: 'Definitive Diagnosis', ...hasEventType(events, 'diagnosis') },
      { phase: 'Treatment Initiation', ...hasEventType(events, 'treatment') },
      { phase: 'Rehabilitation', ...hasEventType(events, 'rehab') },
      { phase: 'Outcome Review', ...hasEventType(events, 'outcome') },
    ],
    outcomeTrends: trends,
    alerts,
  };
}

export function buildClinicalDecisionBundle(input: ClinicalInput): {
  flowchart: ReturnType<typeof generateSymptomFlowchart>;
  examGuidance: string[];
  redFlags: RedFlagAlert[];
  differentials: DifferentialDiagnosis[];
  workup: WorkupRecommendation;
  treatmentTree: DecisionTreeNode[];
  surgicalApproaches: SurgicalApproachOption[];
  preopChecklist: PreopChecklist;
  recoveryTimeline: TimelineMilestone[];
  complicationRisk: ComplicationRiskResult;
  predictedOutcome: ReturnType<typeof predictSurgicalOutcome>;
  returnTimeline: ReturnType<typeof estimateReturnTimeline>;
  comparativeEffectiveness: ComparativeEffectivenessResult;
} {
  const redFlags = detectRedFlags(input);
  const differentials = rankDifferentialDiagnoses(input);
  return {
    flowchart: generateSymptomFlowchart(input.complaint),
    examGuidance: getPhysicalExamGuidance(input.complaint),
    redFlags,
    differentials,
    workup: recommendWorkup(input, differentials, redFlags),
    treatmentTree: buildTreatmentDecisionTree(input),
    surgicalApproaches: compareSurgicalApproaches(input.complaint),
    preopChecklist: generatePreopChecklist(input.procedure || input.complaint, input.comorbidities || []),
    recoveryTimeline: buildRecoveryTimeline(input.procedure || input.complaint),
    complicationRisk: stratifyComplicationRisk(input),
    predictedOutcome: predictSurgicalOutcome(input),
    returnTimeline: estimateReturnTimeline(input),
    comparativeEffectiveness: compareEffectiveness(input),
  };
}

