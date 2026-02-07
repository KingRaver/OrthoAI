#!/usr/bin/env node

import path from 'path';
import { execFileSync } from 'child_process';

const DEFAULT_SLOS = {
  avgMs: 180,
  p95Ms: 450,
  p99Ms: 700,
};

function parseArg(name, fallback) {
  const arg = process.argv.find((value) => value.startsWith(`--${name}=`));
  if (!arg) return fallback;
  return arg.slice(name.length + 3);
}

function parseIntArg(name, fallback, min, max) {
  const raw = parseArg(name, String(fallback));
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function resolveDbPath() {
  const argPath = parseArg('db', '');
  if (argPath) return path.resolve(argPath);
  return path.resolve(process.env.MEMORY_DB_PATH || path.join(process.cwd(), '.data', 'orthoai.db'));
}

function runSql(dbPath, sql) {
  return execFileSync(
    '/usr/bin/sqlite3',
    ['-readonly', '-cmd', '.timeout 5000', dbPath, sql],
    { encoding: 'utf8' }
  ).trim();
}

function tableExists(dbPath, tableName) {
  const safeName = tableName.replace(/'/g, "''");
  const raw = runSql(
    dbPath,
    `SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='${safeName}';`
  );
  return Number.parseInt(raw || '0', 10) > 0;
}

function percentileFromSorted(values, percentile) {
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0];
  const clamped = Math.max(0, Math.min(1, percentile));
  const index = Math.ceil(clamped * values.length) - 1;
  const safeIndex = Math.max(0, Math.min(values.length - 1, index));
  return values[safeIndex];
}

function round(value, digits = 1) {
  const m = Math.pow(10, digits);
  return Math.round(value * m) / m;
}

function summarizeMode(dbPath, whereClause, hours) {
  const windowExpr = `datetime('now', '-${hours} hours')`;
  const sql = `
    SELECT latency_total_ms
    FROM retrieval_metrics
    WHERE created_at >= ${windowExpr}
      AND ${whereClause}
    ORDER BY latency_total_ms ASC;
  `;
  const raw = runSql(dbPath, sql);
  if (!raw) {
    return {
      count: 0,
      avgMs: 0,
      p95Ms: 0,
      p99Ms: 0,
      maxMs: 0,
      minMs: 0,
    };
  }

  const values = raw
    .split('\n')
    .map((line) => Number.parseFloat(line.trim()))
    .filter((value) => Number.isFinite(value));

  const count = values.length;
  if (count === 0) {
    return {
      count: 0,
      avgMs: 0,
      p95Ms: 0,
      p99Ms: 0,
      maxMs: 0,
      minMs: 0,
    };
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    count,
    avgMs: round(total / count, 1),
    p95Ms: round(percentileFromSorted(values, 0.95), 1),
    p99Ms: round(percentileFromSorted(values, 0.99), 1),
    maxMs: round(values[values.length - 1], 1),
    minMs: round(values[0], 1),
  };
}

function evaluateSlo(summary, slos) {
  if (summary.count === 0) {
    return { pass: false, reason: 'insufficient_samples' };
  }
  const pass =
    summary.avgMs <= slos.avgMs &&
    summary.p95Ms <= slos.p95Ms &&
    summary.p99Ms <= slos.p99Ms;
  return {
    pass,
    reason: pass ? 'pass' : 'threshold_exceeded',
  };
}

function formatModeResult(modeName, summary, slos, evaluation, baseline) {
  const hasDelta = summary.count > 0 && baseline && baseline.count > 0;
  const deltaAvg = hasDelta
    ? `${summary.avgMs >= baseline.avgMs ? '+' : ''}${round(summary.avgMs - baseline.avgMs, 1)}`
    : 'n/a';
  const deltaP95 = hasDelta
    ? `${summary.p95Ms >= baseline.p95Ms ? '+' : ''}${round(summary.p95Ms - baseline.p95Ms, 1)}`
    : 'n/a';
  const deltaP99 = hasDelta
    ? `${summary.p99Ms >= baseline.p99Ms ? '+' : ''}${round(summary.p99Ms - baseline.p99Ms, 1)}`
    : 'n/a';

  return [
    `${modeName}`,
    `  count: ${summary.count}`,
    `  avg_ms: ${summary.avgMs} (target <= ${slos.avgMs}) delta_vs_dense=${deltaAvg}`,
    `  p95_ms: ${summary.p95Ms} (target <= ${slos.p95Ms}) delta_vs_dense=${deltaP95}`,
    `  p99_ms: ${summary.p99Ms} (target <= ${slos.p99Ms}) delta_vs_dense=${deltaP99}`,
    `  min/max_ms: ${summary.minMs}/${summary.maxMs}`,
    `  slo: ${evaluation.pass ? 'PASS' : 'FAIL'} (${evaluation.reason})`,
  ].join('\n');
}

function main() {
  const dbPath = resolveDbPath();
  const hours = parseIntArg('hours', 24, 1, 720);
  const minSamples = parseIntArg('min-samples', 20, 1, 5000);
  const slos = {
    avgMs: parseIntArg('slo-avg', DEFAULT_SLOS.avgMs, 1, 5000),
    p95Ms: parseIntArg('slo-p95', DEFAULT_SLOS.p95Ms, 1, 10000),
    p99Ms: parseIntArg('slo-p99', DEFAULT_SLOS.p99Ms, 1, 20000),
  };

  if (!tableExists(dbPath, 'retrieval_metrics')) {
    console.error('retrieval_metrics table not found.');
    console.error('run app traffic first so retrieval metrics are captured.');
    process.exit(1);
  }

  const modes = {
    dense_only: `flag_hybrid = 0 AND flag_chunking = 0`,
    hybrid: `flag_hybrid = 1 AND flag_chunking = 0`,
    chunked: `flag_hybrid = 1 AND flag_chunking = 1`,
  };

  const denseSummary = summarizeMode(dbPath, modes.dense_only, hours);
  const hybridSummary = summarizeMode(dbPath, modes.hybrid, hours);
  const chunkedSummary = summarizeMode(dbPath, modes.chunked, hours);

  const denseEvaluation = evaluateSlo(denseSummary, slos);
  const hybridEvaluation = evaluateSlo(hybridSummary, slos);
  const chunkedEvaluation = evaluateSlo(chunkedSummary, slos);

  console.log('Memory Retrieval Benchmark');
  console.log(`DB: ${dbPath}`);
  console.log(`Window: last ${hours}h`);
  console.log(`SLOs: avg<=${slos.avgMs}ms p95<=${slos.p95Ms}ms p99<=${slos.p99Ms}ms`);
  console.log(`Min samples required per mode: ${minSamples}`);
  console.log('');

  console.log(formatModeResult('dense_only', denseSummary, slos, denseEvaluation, null));
  console.log('');
  console.log(formatModeResult('hybrid', hybridSummary, slos, hybridEvaluation, denseSummary));
  console.log('');
  console.log(formatModeResult('chunked', chunkedSummary, slos, chunkedEvaluation, denseSummary));
  console.log('');

  const hasEnoughSamples =
    denseSummary.count >= minSamples &&
    hybridSummary.count >= minSamples &&
    chunkedSummary.count >= minSamples;

  const allPass =
    denseEvaluation.pass &&
    hybridEvaluation.pass &&
    chunkedEvaluation.pass;

  if (!hasEnoughSamples) {
    console.log('Benchmark gate: FAIL (insufficient samples across one or more modes)');
    process.exit(2);
  }

  if (!allPass) {
    console.log('Benchmark gate: FAIL (one or more modes exceed SLO thresholds)');
    process.exit(3);
  }

  console.log('Benchmark gate: PASS');
}

main();
