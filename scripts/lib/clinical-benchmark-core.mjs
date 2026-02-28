import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import createJiti from 'jiti';

const jiti = createJiti(import.meta.url);

const {
  CLINICAL_RUBRIC_DIMENSIONS,
  CLINICAL_RUBRIC_THRESHOLDS,
} = jiti('../../app/lib/benchmarks/clinicalReasoning/types.ts');

const {
  scoreClinicalBenchmarkCase,
  aggregateClinicalBenchmarkScores,
  buildHybridCaseSummary,
  evaluateGate,
} = jiti('../../app/lib/benchmarks/clinicalReasoning/scorer.ts');

const DEFAULT_BASE_URL = process.env.BENCHMARK_BASE_URL || 'http://127.0.0.1:3000';
const DEFAULT_TIMEOUT_MS = Number.parseInt(process.env.BENCHMARK_REQUEST_TIMEOUT_MS || '120000', 10);
const DEFAULT_DB_PATH = process.env.MEMORY_DB_PATH || path.join(process.cwd(), '.data', 'orthoai.db');
const DEFAULT_FIXTURE_PATH = path.join(
  process.cwd(),
  'app/lib/benchmarks/clinicalReasoning/cases.v1.json',
);
const DEFAULT_REPORT_DIR = path.join(process.cwd(), 'docs/audits/reports');

function randomId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function roundToTenths(value) {
  return Math.round(value * 10) / 10;
}

function parseBoolean(value, fallback) {
  if (value === undefined) return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

function parseNumber(value, fallback) {
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function parseCliArgs(argv = process.argv.slice(2)) {
  const args = {
    baseUrl: DEFAULT_BASE_URL,
    dbPath: DEFAULT_DB_PATH,
    fixturePath: DEFAULT_FIXTURE_PATH,
    reviewFile: undefined,
    reportDir: DEFAULT_REPORT_DIR,
    model: undefined,
    enforceGates: false,
    failOnRegression: false,
    regressionThreshold: 0.2,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  };

  for (const token of argv) {
    if (!token.startsWith('--')) continue;

    if (token === '--enforce-gates') {
      args.enforceGates = true;
      continue;
    }

    if (token === '--fail-on-regression') {
      args.failOnRegression = true;
      continue;
    }

    const [name, ...rest] = token.slice(2).split('=');
    const value = rest.join('=');

    switch (name) {
      case 'base-url':
        args.baseUrl = value || args.baseUrl;
        break;
      case 'db':
        args.dbPath = path.resolve(value || args.dbPath);
        break;
      case 'fixtures':
        args.fixturePath = path.resolve(value || args.fixturePath);
        break;
      case 'review-file':
        args.reviewFile = value ? path.resolve(value) : undefined;
        break;
      case 'report-dir':
        args.reportDir = path.resolve(value || args.reportDir);
        break;
      case 'model':
        args.model = value || undefined;
        break;
      case 'regression-threshold':
        args.regressionThreshold = parseNumber(value, args.regressionThreshold);
        break;
      case 'timeout-ms':
        args.timeoutMs = Math.max(5000, Math.round(parseNumber(value, args.timeoutMs)));
        break;
      case 'enforce-gates':
        args.enforceGates = parseBoolean(value, true);
        break;
      case 'fail-on-regression':
        args.failOnRegression = parseBoolean(value, true);
        break;
      default:
        break;
    }
  }

  return args;
}

export function loadFixtures(fixturePath = DEFAULT_FIXTURE_PATH) {
  const raw = fs.readFileSync(fixturePath, 'utf8');
  const parsed = JSON.parse(raw);

  if (!parsed || !Array.isArray(parsed.cases)) {
    throw new Error(`Invalid fixture file: ${fixturePath}`);
  }

  return parsed;
}

function normalizeReviewDimensionRecord(dimensionRecord) {
  const normalized = {};

  for (const dimension of CLINICAL_RUBRIC_DIMENSIONS) {
    const entry = dimensionRecord?.[dimension];
    if (!entry || typeof entry !== 'object') continue;

    const rawScore = Number(entry.score);
    if (!Number.isFinite(rawScore)) continue;

    const score = Math.max(0, Math.min(4, rawScore));
    normalized[dimension] = {
      score,
      rationale: typeof entry.rationale === 'string' ? entry.rationale : undefined,
    };
  }

  return normalized;
}

export function loadClinicianReviews(reviewFile) {
  if (!reviewFile) return [];
  if (!fs.existsSync(reviewFile)) {
    throw new Error(`Clinician review file not found: ${reviewFile}`);
  }

  const raw = fs.readFileSync(reviewFile, 'utf8');
  const parsed = JSON.parse(raw);
  const reviewList = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.reviews) ? parsed.reviews : [];

  return reviewList
    .map(review => {
      if (!review || typeof review !== 'object') return null;
      if (typeof review.caseId !== 'string' || typeof review.reviewerId !== 'string') return null;
      if (review.target !== 'decision-support' && review.target !== 'llm') return null;

      const source =
        review.source === 'clinician_secondary' || review.source === 'adjudicated'
          ? review.source
          : 'clinician_primary';

      const adjudicationStatus =
        typeof review.adjudicationStatus === 'string'
          ? review.adjudicationStatus
          : undefined;

      return {
        target: review.target,
        caseId: review.caseId,
        reviewerId: review.reviewerId,
        source,
        adjudicationStatus,
        comments: typeof review.comments === 'string' ? review.comments : undefined,
        dimensions: normalizeReviewDimensionRecord(review.dimensions || {}),
      };
    })
    .filter(Boolean);
}

export function openBenchmarkDb(dbPath = DEFAULT_DB_PATH) {
  const resolved = path.resolve(dbPath);
  const dir = path.dirname(resolved);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(resolved);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

export function ensureMigrations(db, projectRoot = process.cwd()) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const migrationsDir = path.join(projectRoot, 'app/lib/memory/migrations');
  const appliedRows = db.prepare('SELECT name FROM schema_migrations').all();
  const applied = new Set(appliedRows.map(row => row.name));

  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort((a, b) => {
      if (a === 'init.sql') return -1;
      if (b === 'init.sql') return 1;
      return a.localeCompare(b);
    });

  for (const migrationFile of migrationFiles) {
    if (applied.has(migrationFile)) continue;

    const migrationSql = fs.readFileSync(path.join(migrationsDir, migrationFile), 'utf8');
    db.exec(migrationSql);
    db.prepare('INSERT INTO schema_migrations(name, applied_at) VALUES (?, ?)').run(
      migrationFile,
      new Date().toISOString(),
    );
  }
}

function createRun(db, { benchmarkType, fixtureVersion, baselineRunId = null, notes = null }) {
  const runId = randomId('bench_run');
  const startedAt = new Date().toISOString();

  db.prepare(`
    INSERT INTO clinical_benchmark_runs (
      id, benchmark_type, fixture_version, started_at, status, baseline_run_id, notes
    ) VALUES (?, ?, ?, ?, 'running', ?, ?)
  `).run(runId, benchmarkType, fixtureVersion, startedAt, baselineRunId, notes ? JSON.stringify(notes) : null);

  return { runId, startedAt };
}

function finalizeRun(
  db,
  runId,
  {
    status,
    automaticGatePassed,
    clinicianGatePassed = null,
    notes = null,
  },
) {
  db.prepare(`
    UPDATE clinical_benchmark_runs
    SET status = ?,
        finished_at = ?,
        automatic_gate_passed = ?,
        clinician_gate_passed = ?,
        notes = ?
    WHERE id = ?
  `).run(
    status,
    new Date().toISOString(),
    automaticGatePassed === null || automaticGatePassed === undefined ? null : Number(Boolean(automaticGatePassed)),
    clinicianGatePassed === null || clinicianGatePassed === undefined ? null : Number(Boolean(clinicianGatePassed)),
    notes ? JSON.stringify(notes) : null,
    runId,
  );
}

function insertDimensionScore(db, {
  caseResultId,
  dimensionKey,
  sourceType,
  reviewerId = null,
  score,
  rationale = null,
}) {
  db.prepare(`
    INSERT INTO clinical_benchmark_dimension_scores (
      id, case_result_id, dimension_key, source_type, reviewer_id, score, rationale
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    randomId('bench_dim'),
    caseResultId,
    dimensionKey,
    sourceType,
    reviewerId,
    score,
    rationale,
  );
}

function buildClinicianRunSummary(hybridCaseResults) {
  const scoreBuckets = Object.fromEntries(
    CLINICAL_RUBRIC_DIMENSIONS.map(dimension => [dimension, []]),
  );

  let reviewedCases = 0;
  let disagreementCount = 0;

  for (const hybrid of hybridCaseResults) {
    if (!hybrid.clinician.available) continue;
    reviewedCases += 1;
    disagreementCount += hybrid.autoVsClinicianDisagreementCount;

    for (const dimension of CLINICAL_RUBRIC_DIMENSIONS) {
      const value = hybrid.clinician.perDimensionAverage?.[dimension];
      if (typeof value === 'number') {
        scoreBuckets[dimension].push(value);
      }
    }
  }

  if (reviewedCases === 0) {
    return {
      available: false,
      reviewedCases: 0,
      disagreementCount: 0,
      averageScore: null,
      perDimensionAverage: null,
      gate: null,
    };
  }

  const perDimensionAverage = Object.fromEntries(
    CLINICAL_RUBRIC_DIMENSIONS.map(dimension => {
      const values = scoreBuckets[dimension];
      if (!values || values.length === 0) return [dimension, 0];
      return [dimension, roundToTenths(values.reduce((sum, value) => sum + value, 0) / values.length)];
    }),
  );

  const overallAverage = roundToTenths(
    CLINICAL_RUBRIC_DIMENSIONS.reduce((sum, dimension) => sum + perDimensionAverage[dimension], 0) /
      CLINICAL_RUBRIC_DIMENSIONS.length,
  );

  return {
    available: true,
    reviewedCases,
    disagreementCount,
    averageScore: overallAverage,
    perDimensionAverage,
    gate: evaluateGate(perDimensionAverage, overallAverage, CLINICAL_RUBRIC_THRESHOLDS),
  };
}

function persistCaseResult(db, {
  runId,
  target,
  caseScore,
  hybridSummary,
  caseReviews,
}) {
  const caseResultId = randomId('bench_case');

  const clinicianGate = hybridSummary.clinician.available
    ? evaluateGate(
        Object.fromEntries(
          CLINICAL_RUBRIC_DIMENSIONS.map(dimension => [
            dimension,
            typeof hybridSummary.clinician.perDimensionAverage?.[dimension] === 'number'
              ? hybridSummary.clinician.perDimensionAverage[dimension]
              : 0,
          ]),
        ),
        roundToTenths(
          CLINICAL_RUBRIC_DIMENSIONS.reduce((sum, dimension) => {
            const value = hybridSummary.clinician.perDimensionAverage?.[dimension];
            return sum + (typeof value === 'number' ? value : 0);
          }, 0) / CLINICAL_RUBRIC_DIMENSIONS.length,
        ),
        CLINICAL_RUBRIC_THRESHOLDS,
      )
    : null;

  const clinicianComments = caseReviews
    .map(review => review.comments)
    .filter(comment => typeof comment === 'string' && comment.trim().length > 0)
    .join('\n\n');

  const autoDimensionNotes = CLINICAL_RUBRIC_DIMENSIONS.map(dimension => ({
    dimension,
    notes: caseScore.dimensions[dimension].notes,
    matchedTerms: caseScore.dimensions[dimension].matchedTerms,
    missedTerms: caseScore.dimensions[dimension].missedTerms,
  }));

  db.prepare(`
    INSERT INTO clinical_benchmark_case_results (
      id,
      run_id,
      benchmark_target,
      case_id,
      case_title,
      mode_used,
      model_used,
      average_score,
      passed_automatic,
      passed_clinician,
      automatic_notes,
      clinician_notes,
      disagreement_count,
      adjudication_status,
      response_payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    caseResultId,
    runId,
    target,
    caseScore.caseId,
    caseScore.caseTitle,
    caseScore.modeUsed || null,
    caseScore.modelUsed || null,
    caseScore.averageScore,
    Number(Boolean(caseScore.passed)),
    clinicianGate ? Number(Boolean(clinicianGate.passed)) : null,
    JSON.stringify(autoDimensionNotes),
    clinicianComments || null,
    hybridSummary.autoVsClinicianDisagreementCount,
    hybridSummary.clinician.adjudicationStatus,
    JSON.stringify(caseScore.rawResponse ?? null),
  );

  for (const dimension of CLINICAL_RUBRIC_DIMENSIONS) {
    insertDimensionScore(db, {
      caseResultId,
      dimensionKey: dimension,
      sourceType: 'automated',
      score: caseScore.dimensions[dimension].score,
      rationale: caseScore.dimensions[dimension].notes,
    });
  }

  for (const review of caseReviews) {
    for (const dimension of CLINICAL_RUBRIC_DIMENSIONS) {
      const entry = review.dimensions?.[dimension];
      if (!entry || typeof entry.score !== 'number') continue;

      insertDimensionScore(db, {
        caseResultId,
        dimensionKey: dimension,
        sourceType: review.source,
        reviewerId: review.reviewerId,
        score: Math.max(0, Math.min(4, entry.score)),
        rationale: entry.rationale || review.comments || null,
      });
    }
  }

  return caseResultId;
}

async function fetchJsonWithTimeout(url, init, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
    });

    const bodyText = await response.text();
    let jsonBody = null;

    if (bodyText) {
      try {
        jsonBody = JSON.parse(bodyText);
      } catch {
        jsonBody = { raw: bodyText };
      }
    }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        body: jsonBody,
      };
    }

    return {
      ok: true,
      status: response.status,
      body: jsonBody,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function buildLlmPrompt(caseFixture) {
  const input = caseFixture.input;
  const exam = Array.isArray(input.examFindings) ? input.examFindings : [];

  return [
    'You are completing a standardized orthopedic benchmark case.',
    `Case ID: ${caseFixture.id}`,
    `Title: ${caseFixture.title}`,
    '',
    `Complaint: ${input.complaint}`,
    input.history ? `History: ${input.history}` : null,
    exam.length > 0 ? `Exam Findings: ${exam.join('; ')}` : null,
    typeof input.age === 'number' ? `Age: ${input.age}` : null,
    Array.isArray(input.comorbidities) && input.comorbidities.length > 0
      ? `Comorbidities: ${input.comorbidities.join(', ')}`
      : null,
    input.activityGoal ? `Activity Goal: ${input.activityGoal}` : null,
    input.procedure ? `Procedure Context: ${input.procedure}` : null,
    typeof input.daysSinceInjury === 'number' ? `Days Since Injury: ${input.daysSinceInjury}` : null,
    '',
    'Respond with structured clinical reasoning using these headings exactly:',
    '- Assessment',
    '- Ranked Differential',
    '- Workup',
    '- Treatment Plan',
    '- Red Flags and Escalation',
    '- Exam Protocol',
    '- Imaging Guidance',
    '- Rehab and Return-to-Play',
    '- Next Steps',
  ]
    .filter(Boolean)
    .join('\n');
}

function getLatestCompletedRun(db, benchmarkType, excludeRunId = null) {
  const row = db
    .prepare(`
      SELECT id, benchmark_type, fixture_version, started_at, finished_at, automatic_gate_passed, notes
      FROM clinical_benchmark_runs
      WHERE benchmark_type = ?
        AND status = 'completed'
        ${excludeRunId ? 'AND id != ?' : ''}
      ORDER BY started_at DESC
      LIMIT 1
    `)
    .get(...(excludeRunId ? [benchmarkType, excludeRunId] : [benchmarkType]));

  if (!row) return null;

  let parsedNotes = null;
  if (typeof row.notes === 'string' && row.notes.trim().length > 0) {
    try {
      parsedNotes = JSON.parse(row.notes);
    } catch {
      parsedNotes = null;
    }
  }

  return {
    ...row,
    notes: parsedNotes,
  };
}

function getRunDimensionAverages(db, runId, sourceType = 'automated') {
  const rows = db
    .prepare(`
      SELECT d.dimension_key AS dimension_key, AVG(d.score) AS average_score
      FROM clinical_benchmark_dimension_scores d
      JOIN clinical_benchmark_case_results c ON c.id = d.case_result_id
      WHERE c.run_id = ?
        AND d.source_type = ?
      GROUP BY d.dimension_key
    `)
    .all(runId, sourceType);

  const output = Object.fromEntries(
    CLINICAL_RUBRIC_DIMENSIONS.map(dimension => [dimension, 0]),
  );

  for (const row of rows) {
    if (!Object.prototype.hasOwnProperty.call(output, row.dimension_key)) continue;
    output[row.dimension_key] = roundToTenths(Number(row.average_score || 0));
  }

  return output;
}

function getRunCasePassMap(db, runId, target) {
  const rows = db
    .prepare(`
      SELECT case_id, passed_automatic
      FROM clinical_benchmark_case_results
      WHERE run_id = ?
        AND benchmark_target = ?
    `)
    .all(runId, target);

  return new Map(rows.map(row => [row.case_id, Boolean(row.passed_automatic)]));
}

function calculateDimensionRegressions(current, baseline, threshold) {
  if (!baseline) return [];

  const regressions = [];
  for (const dimension of CLINICAL_RUBRIC_DIMENSIONS) {
    const currentValue = Number(current?.[dimension] ?? 0);
    const baselineValue = Number(baseline?.[dimension] ?? 0);
    const delta = roundToTenths(currentValue - baselineValue);
    if (delta < -Math.abs(threshold)) {
      regressions.push({
        dimension,
        current: currentValue,
        baseline: baselineValue,
        delta,
      });
    }
  }

  return regressions;
}

function calculateCaseRegressions(caseResults, baselinePassMap) {
  if (!baselinePassMap) return [];
  return caseResults
    .filter(result => baselinePassMap.get(result.caseId) === true && !result.passed)
    .map(result => ({
      caseId: result.caseId,
      caseTitle: result.caseTitle,
      baselinePassed: true,
      currentPassed: result.passed,
      averageScore: result.averageScore,
    }));
}

function getClinicianReviewsForCase(reviews, target, caseId) {
  return reviews.filter(review => review.target === target && review.caseId === caseId);
}

function printTargetSummary(targetResult) {
  const { target, aggregate } = targetResult;
  console.log(`\n${target.toUpperCase()} benchmark`);
  console.log(`run: ${targetResult.runId}`);
  console.log(`cases: ${aggregate.totalCases}`);
  console.log(`average score: ${aggregate.averageScore}`);
  console.log(`automatic gate: ${aggregate.gate.passed ? 'PASS' : 'FAIL'}`);

  if (targetResult.clinicianSummary?.available) {
    console.log(`clinician reviewed cases: ${targetResult.clinicianSummary.reviewedCases}`);
    console.log(`clinician gate: ${targetResult.clinicianSummary.gate.passed ? 'PASS' : 'FAIL'}`);
  }
}

async function runTargetBenchmark({
  target,
  db,
  fixtures,
  baseUrl,
  timeoutMs,
  model,
  clinicianReviews,
  regressionThreshold = 0.2,
}) {
  const baseline = getLatestCompletedRun(db, target);

  const run = createRun(db, {
    benchmarkType: target,
    fixtureVersion: fixtures.version,
    baselineRunId: baseline?.id || null,
    notes: {
      target,
      fixtureVersion: fixtures.version,
    },
  });

  const caseResults = [];
  const hybridCaseResults = [];

  try {
    for (const caseFixture of fixtures.cases) {
      let rawResponse = null;
      let modeUsed = target === 'llm' ? caseFixture.llmMode || 'clinical-consult' : 'clinical-consult';
      let modelUsed = target === 'llm' ? model || undefined : 'decision-support-bundle';

      if (target === 'decision-support') {
        const url = `${baseUrl.replace(/\/$/, '')}/api/clinical/decision-support`;
        const result = await fetchJsonWithTimeout(
          url,
          {
            method: 'POST',
            body: JSON.stringify({
              action: 'bundle',
              ...caseFixture.input,
            }),
          },
          timeoutMs,
        );

        rawResponse = result.ok
          ? result.body?.bundle ?? result.body
          : {
              error: `HTTP ${result.status}`,
              details: result.body,
            };
      } else {
        const url = `${baseUrl.replace(/\/$/, '')}/api/llm`;
        const payload = {
          model,
          stream: false,
          enableTools: false,
          useMemory: false,
          manualModeOverride: caseFixture.llmMode || 'clinical-consult',
          messages: [
            {
              role: 'user',
              content: buildLlmPrompt(caseFixture),
            },
          ],
        };

        const result = await fetchJsonWithTimeout(
          url,
          {
            method: 'POST',
            body: JSON.stringify(payload),
          },
          timeoutMs,
        );

        rawResponse = result.ok
          ? result.body?.content ?? result.body
          : {
              error: `HTTP ${result.status}`,
              details: result.body,
            };

        if (result.ok && result.body && typeof result.body === 'object') {
          modeUsed = result.body.modeUsed || modeUsed;
          modelUsed = result.body.autoSelectedModel || modelUsed;
        }
      }

      const caseScore = scoreClinicalBenchmarkCase(caseFixture, rawResponse, {
        target,
        modeUsed,
        modelUsed,
      });

      const caseReviews = getClinicianReviewsForCase(clinicianReviews, target, caseFixture.id);
      const hybridSummary = buildHybridCaseSummary(caseScore, caseReviews);

      persistCaseResult(db, {
        runId: run.runId,
        target,
        caseScore,
        hybridSummary,
        caseReviews,
      });

      caseResults.push(caseScore);
      hybridCaseResults.push(hybridSummary);
    }

    const aggregate = aggregateClinicalBenchmarkScores(caseResults, CLINICAL_RUBRIC_THRESHOLDS);
    const clinicianSummary = buildClinicianRunSummary(hybridCaseResults);

    const baselineDimensionAverages = baseline
      ? getRunDimensionAverages(db, baseline.id, 'automated')
      : null;
    const baselinePassMap = baseline ? getRunCasePassMap(db, baseline.id, target) : null;

    const dimensionRegressions = calculateDimensionRegressions(
      aggregate.perDimensionAverage,
      baselineDimensionAverages,
      regressionThreshold,
    );
    const caseRegressions = calculateCaseRegressions(caseResults, baselinePassMap);

    finalizeRun(db, run.runId, {
      status: 'completed',
      automaticGatePassed: aggregate.gate.passed,
      clinicianGatePassed: clinicianSummary.available ? clinicianSummary.gate.passed : null,
      notes: {
        target,
        fixtureVersion: fixtures.version,
        aggregate,
        clinicianSummary,
        dimensionRegressions,
        caseRegressions,
      },
    });

    const result = {
      target,
      runId: run.runId,
      startedAt: run.startedAt,
      baselineRunId: baseline?.id || null,
      aggregate,
      clinicianSummary,
      caseResults,
      hybridCaseResults,
      dimensionRegressions,
      caseRegressions,
    };

    printTargetSummary(result);
    return result;
  } catch (error) {
    finalizeRun(db, run.runId, {
      status: 'failed',
      automaticGatePassed: false,
      clinicianGatePassed: null,
      notes: {
        target,
        error: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}

export async function runDecisionSupportBenchmark(options) {
  return runTargetBenchmark({
    ...options,
    target: 'decision-support',
  });
}

export async function runLlmBenchmark(options) {
  return runTargetBenchmark({
    ...options,
    target: 'llm',
  });
}

export function mergeTargetResults(decisionSupportResult, llmResult) {
  const allCaseResults = [...decisionSupportResult.caseResults, ...llmResult.caseResults];
  const mergedAggregate = aggregateClinicalBenchmarkScores(allCaseResults, CLINICAL_RUBRIC_THRESHOLDS);

  const allHybrid = [...decisionSupportResult.hybridCaseResults, ...llmResult.hybridCaseResults];
  const clinicianSummary = buildClinicianRunSummary(allHybrid);

  return {
    aggregate: mergedAggregate,
    clinicianSummary,
    allCaseResults,
    allHybrid,
  };
}

export function createCombinedRun(db, {
  fixtureVersion,
  merged,
  decisionSupportRunId,
  llmRunId,
  regressionThreshold,
}) {
  const baseline = getLatestCompletedRun(db, 'all');

  const run = createRun(db, {
    benchmarkType: 'all',
    fixtureVersion,
    baselineRunId: baseline?.id || null,
    notes: {
      decisionSupportRunId,
      llmRunId,
    },
  });

  const baselinePerDimension = baseline?.notes?.merged?.aggregate?.perDimensionAverage || null;

  const dimensionRegressions = calculateDimensionRegressions(
    merged.aggregate.perDimensionAverage,
    baselinePerDimension,
    regressionThreshold,
  );

  finalizeRun(db, run.runId, {
    status: 'completed',
    automaticGatePassed: merged.aggregate.gate.passed,
    clinicianGatePassed: merged.clinicianSummary.available
      ? merged.clinicianSummary.gate.passed
      : null,
    notes: {
      decisionSupportRunId,
      llmRunId,
      merged: {
        aggregate: merged.aggregate,
        clinicianSummary: merged.clinicianSummary,
      },
      dimensionRegressions,
      regressionThreshold,
    },
  });

  return {
    runId: run.runId,
    baselineRunId: baseline?.id || null,
    baselinePerDimension,
    dimensionRegressions,
  };
}

export function createMarkdownReport({
  generatedAt,
  decisionSupport,
  llm,
  merged,
  combinedRun,
}) {
  const failingCases = merged.allCaseResults.filter(caseResult => !caseResult.passed);

  const disagreementRows = merged.allHybrid
    .filter(item => item.autoVsClinicianDisagreementCount > 0)
    .map(item => ({
      caseId: item.caseResult.caseId,
      target: item.caseResult.target,
      disagreements: item.autoVsClinicianDisagreementCount,
      adjudicationStatus: item.clinician.adjudicationStatus,
    }));

  const lines = [
    '# Clinical Benchmark Report',
    '',
    `- Generated at: ${generatedAt}`,
    `- Combined run ID: ${combinedRun.runId}`,
    `- Decision-support run ID: ${decisionSupport.runId}`,
    `- LLM run ID: ${llm.runId}`,
    combinedRun.baselineRunId
      ? `- Baseline combined run ID: ${combinedRun.baselineRunId}`
      : '- Baseline combined run ID: none',
    '',
    '## Automated Summary',
    `- Combined gate: ${merged.aggregate.gate.passed ? 'PASS' : 'FAIL'}`,
    `- Combined average score: ${merged.aggregate.averageScore}`,
    `- Decision-support gate: ${decisionSupport.aggregate.gate.passed ? 'PASS' : 'FAIL'}`,
    `- Decision-support average score: ${decisionSupport.aggregate.averageScore}`,
    `- LLM gate: ${llm.aggregate.gate.passed ? 'PASS' : 'FAIL'}`,
    `- LLM average score: ${llm.aggregate.averageScore}`,
    '',
    '### Combined Per-Dimension Averages',
    '| Dimension | Score | Target |',
    '| --- | ---: | ---: |',
    ...CLINICAL_RUBRIC_DIMENSIONS.map(
      dimension =>
        `| ${dimension} | ${merged.aggregate.perDimensionAverage[dimension]} | ${
          dimension === 'redFlagDetection'
            ? CLINICAL_RUBRIC_THRESHOLDS.redFlagMin
            : CLINICAL_RUBRIC_THRESHOLDS.requiredDimensionMin
        } |`,
    ),
    '',
    '### Gate Checks',
    ...merged.aggregate.gate.checks.map(
      check =>
        `- ${check.id}: ${check.passed ? 'PASS' : 'FAIL'} (observed ${check.observed}, min ${check.expectedMin})`,
    ),
    '',
  ];

  if (merged.clinicianSummary.available) {
    lines.push(
      '## Clinician Summary',
      `- Reviewed cases: ${merged.clinicianSummary.reviewedCases}`,
      `- Clinician gate: ${merged.clinicianSummary.gate.passed ? 'PASS' : 'FAIL'}`,
      `- Clinician average score: ${merged.clinicianSummary.averageScore}`,
      `- Total auto-vs-clinician disagreement count: ${merged.clinicianSummary.disagreementCount}`,
      '',
      '### Clinician Per-Dimension Averages',
      '| Dimension | Score |',
      '| --- | ---: |',
      ...CLINICAL_RUBRIC_DIMENSIONS.map(
        dimension => `| ${dimension} | ${merged.clinicianSummary.perDimensionAverage[dimension]} |`,
      ),
      '',
    );
  } else {
    lines.push(
      '## Clinician Summary',
      '- No clinician review file provided for this run.',
      '',
    );
  }

  lines.push('## Disagreement Summary');
  if (disagreementRows.length === 0) {
    lines.push('- No auto-vs-clinician disagreements >= 1 point were detected.');
  } else {
    lines.push('| Target | Case ID | Disagreement Count | Adjudication |');
    lines.push('| --- | --- | ---: | --- |');
    for (const row of disagreementRows) {
      lines.push(
        `| ${row.target} | ${row.caseId} | ${row.disagreements} | ${row.adjudicationStatus} |`,
      );
    }
  }

  lines.push('', '## Failing Cases');
  if (failingCases.length === 0) {
    lines.push('- No failing cases.');
  } else {
    for (const caseResult of failingCases) {
      lines.push(
        `- ${caseResult.target} ${caseResult.caseId} (${caseResult.caseTitle}) average=${caseResult.averageScore}`,
      );
    }
  }

  lines.push('', '## Diff vs Prior Run');
  if (combinedRun.dimensionRegressions.length === 0) {
    lines.push('- No per-dimension regression exceeded threshold.');
  } else {
    lines.push('| Dimension | Baseline | Current | Delta |');
    lines.push('| --- | ---: | ---: | ---: |');
    for (const row of combinedRun.dimensionRegressions) {
      lines.push(`| ${row.dimension} | ${row.baseline} | ${row.current} | ${row.delta} |`);
    }
  }

  lines.push('', '## Case Regressions');
  const allCaseRegressions = [
    ...decisionSupport.caseRegressions,
    ...llm.caseRegressions,
  ];

  if (allCaseRegressions.length === 0) {
    lines.push('- No case-level pass/fail regressions versus prior target run.');
  } else {
    for (const regression of allCaseRegressions) {
      lines.push(
        `- ${regression.caseId} (${regression.caseTitle}) regressed to FAIL with average=${regression.averageScore}`,
      );
    }
  }

  lines.push('');
  return lines.join('\n');
}

export function writeMarkdownReport(reportDir, reportText, generatedAt = new Date().toISOString()) {
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const safeTimestamp = generatedAt.replace(/[:.]/g, '-');
  const reportPath = path.join(reportDir, `clinical-benchmark-${safeTimestamp}.md`);
  fs.writeFileSync(reportPath, reportText, 'utf8');
  return reportPath;
}

export function shouldFailForRegression(combinedRun, failOnRegression) {
  if (!failOnRegression) return false;
  return combinedRun.dimensionRegressions.length > 0;
}

export function summarizeOutcome({
  decisionSupport,
  llm,
  merged,
  combinedRun,
}) {
  return {
    decisionSupport: {
      runId: decisionSupport.runId,
      gatePassed: decisionSupport.aggregate.gate.passed,
      averageScore: decisionSupport.aggregate.averageScore,
      totalCases: decisionSupport.aggregate.totalCases,
      dimensionAverages: decisionSupport.aggregate.perDimensionAverage,
    },
    llm: {
      runId: llm.runId,
      gatePassed: llm.aggregate.gate.passed,
      averageScore: llm.aggregate.averageScore,
      totalCases: llm.aggregate.totalCases,
      dimensionAverages: llm.aggregate.perDimensionAverage,
    },
    merged: {
      runId: combinedRun.runId,
      gatePassed: merged.aggregate.gate.passed,
      averageScore: merged.aggregate.averageScore,
      totalCases: merged.aggregate.totalCases,
      dimensionAverages: merged.aggregate.perDimensionAverage,
      dimensionRegressions: combinedRun.dimensionRegressions,
    },
  };
}

export function createExecutionContext(args) {
  const fixtures = loadFixtures(args.fixturePath);
  const clinicianReviews = loadClinicianReviews(args.reviewFile);
  const db = openBenchmarkDb(args.dbPath);
  ensureMigrations(db, process.cwd());

  return {
    args,
    fixtures,
    clinicianReviews,
    db,
  };
}

export function closeExecutionContext(context) {
  context.db.close();
}
