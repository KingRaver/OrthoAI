#!/usr/bin/env node

import path from 'path';
import { execFileSync } from 'child_process';

function resolveDbPath() {
  const arg = process.argv.find((v) => v.startsWith('--db='));
  if (arg) {
    return path.resolve(arg.slice('--db='.length));
  }
  return path.resolve(process.env.MEMORY_DB_PATH || path.join(process.cwd(), '.data', 'orthoai.db'));
}

function resolveHours() {
  const arg = process.argv.find((v) => v.startsWith('--hours='));
  if (!arg) return 24;
  const parsed = Number.parseInt(arg.slice('--hours='.length), 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 720) return 24;
  return parsed;
}

function runSql(dbPath, sql) {
  return execFileSync(
    '/usr/bin/sqlite3',
    ['-readonly', '-cmd', '.timeout 5000', dbPath, sql],
    { encoding: 'utf8' }
  ).trim();
}

function tableExists(dbPath, tableName) {
  const safeTable = tableName.replace(/'/g, "''");
  const raw = runSql(
    dbPath,
    `SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = '${safeTable}';`
  );
  return Number.parseInt(raw || '0', 10) > 0;
}

function printSection(title) {
  console.log('');
  console.log(title);
  console.log('-'.repeat(title.length));
}

function main() {
  const dbPath = resolveDbPath();
  const hours = resolveHours();
  const windowExpr = `datetime('now', '-${hours} hours')`;

  console.log('Memory Hybrid Canary Report');
  console.log(`DB: ${dbPath}`);
  console.log(`Window: last ${hours}h`);

  const overall = runSql(
    dbPath,
    `SELECT
       COUNT(*) || '|' ||
       COALESCE(SUM(flag_hybrid), 0) || '|' ||
       ROUND(COALESCE(AVG(latency_total_ms), 0), 1) || '|' ||
       COALESCE(MAX(latency_total_ms), 0)
     FROM retrieval_metrics
     WHERE created_at >= ${windowExpr};`
  );
  const [totalRaw, hybridOnRaw, avgRaw, maxRaw] = overall.split('|');
  const total = Number.parseInt(totalRaw || '0', 10);
  const hybridOn = Number.parseInt(hybridOnRaw || '0', 10);
  const avgMs = Number.parseFloat(avgRaw || '0');
  const maxMs = Number.parseInt(maxRaw || '0', 10);

  printSection('Overall');
  console.log(`retrievals:         ${total}`);
  console.log(`hybrid-on events:   ${hybridOn}`);
  console.log(`avg latency (ms):   ${avgMs}`);
  console.log(`max latency (ms):   ${maxMs}`);

  const byMode = runSql(
    dbPath,
    `SELECT
       CASE WHEN flag_hybrid = 1 THEN 'hybrid_on' ELSE 'hybrid_off' END || '|' ||
       COUNT(*) || '|' ||
       ROUND(COALESCE(AVG(latency_total_ms), 0), 1) || '|' ||
       COALESCE(MAX(latency_total_ms), 0) || '|' ||
       ROUND(COALESCE(AVG(source_fts_lexical), 0), 2)
     FROM retrieval_metrics
     WHERE created_at >= ${windowExpr}
     GROUP BY flag_hybrid
     ORDER BY flag_hybrid DESC;`
  );

  printSection('By Hybrid Flag');
  if (!byMode) {
    console.log('(no rows)');
  } else {
    byMode
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => {
        const [mode, count, avg, max, avgFts] = line.split('|');
        console.log(
          `${mode}: count=${count}, avg_ms=${avg}, max_ms=${max}, avg_fts_results=${avgFts}`
        );
      });
  }

  const daily = runSql(
    dbPath,
    `SELECT
       DATE(created_at) || '|' ||
       COUNT(*) || '|' ||
       ROUND(COALESCE(AVG(latency_total_ms), 0), 1) || '|' ||
       COALESCE(MAX(latency_total_ms), 0) || '|' ||
       COALESCE(SUM(flag_hybrid), 0)
     FROM retrieval_metrics
     WHERE created_at >= datetime('now', '-7 days')
     GROUP BY DATE(created_at)
     ORDER BY DATE(created_at) DESC
     LIMIT 7;`
  );

  printSection('Daily (7d)');
  if (!daily) {
    console.log('(no rows)');
  } else {
    daily
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => {
        const [date, count, avg, max, hybridCount] = line.split('|');
        console.log(
          `${date}: count=${count}, avg_ms=${avg}, max_ms=${max}, hybrid_on=${hybridCount}`
        );
      });
  }

  const hasSummaryTables =
    tableExists(dbPath, 'summary_events') &&
    tableExists(dbPath, 'summary_health');

  if (!hasSummaryTables) {
    printSection('Summary/Profile Reliability');
    console.log('summary health tables not found (run latest migrations first)');
    return;
  }

  const summaryWindow = runSql(
    dbPath,
    `SELECT
       COALESCE(SUM(CASE WHEN state = 'running' THEN 1 ELSE 0 END), 0) || '|' ||
       COALESCE(SUM(CASE WHEN state = 'succeeded' THEN 1 ELSE 0 END), 0) || '|' ||
       COALESCE(SUM(CASE WHEN state = 'failed' THEN 1 ELSE 0 END), 0) || '|' ||
       COALESCE(SUM(CASE WHEN state = 'skipped_no_consent' THEN 1 ELSE 0 END), 0)
     FROM summary_events
     WHERE created_at >= ${windowExpr};`
  );
  const [summaryRunsRaw, summarySuccessRaw, summaryFailureRaw, summarySkippedRaw] =
    summaryWindow.split('|');
  const summaryRuns = Number.parseInt(summaryRunsRaw || '0', 10);
  const summarySuccesses = Number.parseInt(summarySuccessRaw || '0', 10);
  const summaryFailures = Number.parseInt(summaryFailureRaw || '0', 10);
  const summarySkipped = Number.parseInt(summarySkippedRaw || '0', 10);
  const summarySuccessRate = summaryRuns > 0 ? ((summarySuccesses / summaryRuns) * 100).toFixed(2) : '0.00';
  const summaryFailureRate = summaryRuns > 0 ? ((summaryFailures / summaryRuns) * 100).toFixed(2) : '0.00';

  const summaryTotals = runSql(
    dbPath,
    `SELECT
       COUNT(*) || '|' ||
       COALESCE(SUM(total_runs), 0) || '|' ||
       COALESCE(SUM(total_successes), 0) || '|' ||
       COALESCE(SUM(total_failures), 0) || '|' ||
       COALESCE(SUM(total_retries), 0)
     FROM summary_health;`
  );
  const [trackedConversationsRaw, totalRunsRaw, totalSuccessRaw, totalFailureRaw, totalRetryRaw] =
    summaryTotals.split('|');

  printSection('Summary/Profile Reliability');
  console.log(`summary runs (${hours}h):        ${summaryRuns}`);
  console.log(`summary successes (${hours}h):   ${summarySuccesses}`);
  console.log(`summary failures (${hours}h):    ${summaryFailures}`);
  console.log(`summary skipped no consent:      ${summarySkipped}`);
  console.log(`summary success rate (${hours}h): ${summarySuccessRate}%`);
  console.log(`summary failure rate (${hours}h): ${summaryFailureRate}%`);
  console.log(`tracked conversations:           ${trackedConversationsRaw || '0'}`);
  console.log(`lifetime runs/success/fail/retry: ${totalRunsRaw || '0'}/${totalSuccessRaw || '0'}/${totalFailureRaw || '0'}/${totalRetryRaw || '0'}`);

  const profileSnapshot = runSql(
    dbPath,
    `SELECT
       COUNT(*) || '|' ||
       COALESCE(MAX(updated_at), 'none') || '|' ||
       COALESCE(MAX(embedding_status), 'none')
     FROM user_profile;`
  );
  const [profileRowsRaw, profileUpdatedAt, profileEmbeddingStatus] = profileSnapshot.split('|');
  console.log(`user_profile rows:               ${profileRowsRaw || '0'}`);
  console.log(`user_profile updated_at:         ${profileUpdatedAt || 'none'}`);
  console.log(`user_profile embedding_status:   ${profileEmbeddingStatus || 'none'}`);

  const recentSummaryFailures = runSql(
    dbPath,
    `SELECT
       conversation_id || '|' ||
       attempt || '|' ||
       COALESCE(error_message, '') || '|' ||
       created_at
     FROM summary_events
     WHERE state = 'failed'
     ORDER BY created_at DESC
     LIMIT 5;`
  );
  printSection('Recent Summary Failures');
  if (!recentSummaryFailures) {
    console.log('(no rows)');
  } else {
    recentSummaryFailures
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => {
        const [conversationId, attempt, errorMessage, createdAt] = line.split('|');
        const safeError = (errorMessage || '').replace(/\s+/g, ' ').slice(0, 120);
        console.log(
          `${createdAt}: conversation=${conversationId}, attempt=${attempt}, error="${safeError}"`
        );
      });
  }
}

main();
