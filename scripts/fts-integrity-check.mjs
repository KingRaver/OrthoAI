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

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function runSql(dbPath, sql) {
  return execFileSync(
    '/usr/bin/sqlite3',
    ['-readonly', '-cmd', '.timeout 5000', dbPath, sql],
    { encoding: 'utf8' }
  ).trim();
}

function getCount(dbPath, sql) {
  const raw = runSql(dbPath, sql);
  const parsed = Number.parseInt(raw || '0', 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildReport(dbPath) {
  const messagesTotal = getCount(dbPath, 'SELECT COUNT(*) FROM messages');
  const indexableMessages = getCount(
    dbPath,
    "SELECT COUNT(*) AS count FROM messages WHERE role IN ('user', 'assistant')"
  );
  const ftsRows = getCount(dbPath, 'SELECT COUNT(*) FROM messages_fts');
  const distinctMessageIds = getCount(
    dbPath,
    'SELECT COUNT(*) AS count FROM (SELECT DISTINCT message_id FROM messages_fts)'
  );
  const orphanRows = getCount(
    dbPath,
    `SELECT COUNT(*) AS count
     FROM messages_fts f
     LEFT JOIN messages m ON m.id = f.message_id
     WHERE m.id IS NULL`
  );
  const duplicateMessageIds = getCount(
    dbPath,
    `SELECT COUNT(*) AS count
     FROM (
       SELECT message_id
       FROM messages_fts
       GROUP BY message_id
       HAVING COUNT(*) > 1
     )`
  );
  const duplicateExtraRows = getCount(
    dbPath,
    `SELECT COALESCE(SUM(cnt - 1), 0) AS count
     FROM (
       SELECT COUNT(*) AS cnt
       FROM messages_fts
       GROUP BY message_id
       HAVING COUNT(*) > 1
     )`
  );

  const topDuplicateRows = runSql(
    dbPath,
    `SELECT message_id || '|' || COUNT(*) AS row
     FROM messages_fts
     GROUP BY message_id
     HAVING COUNT(*) > 1
     ORDER BY COUNT(*) DESC
     LIMIT 10`
  );
  const topDuplicates = topDuplicateRows
    .split('\n')
    .map(v => v.trim())
    .filter(Boolean)
    .map(v => {
      const [message_id, countRaw] = v.split('|');
      return {
        message_id,
        count: Number.parseInt(countRaw || '0', 10),
      };
    });

  const rowsPerMessageRatio =
    distinctMessageIds > 0 ? Number((ftsRows / distinctMessageIds).toFixed(4)) : 0;
  const indexedCoverageRatio =
    indexableMessages > 0
      ? Number((distinctMessageIds / indexableMessages).toFixed(4))
      : 1;

  const passes =
    orphanRows === 0 &&
    duplicateExtraRows === 0 &&
    distinctMessageIds === indexableMessages;

  return {
    dbPath,
    checkedAt: new Date().toISOString(),
    messagesTotal,
    indexableMessages,
    ftsRows,
    distinctMessageIds,
    orphanRows,
    duplicateMessageIds,
    duplicateExtraRows,
    rowsPerMessageRatio,
    indexedCoverageRatio,
    passes,
    topDuplicates,
  };
}

function printReport(report) {
  console.log('FTS Integrity Report');
  console.log(`DB: ${report.dbPath}`);
  console.log(`Checked: ${report.checkedAt}`);
  console.log('');
  console.log(`Messages (all):           ${report.messagesTotal}`);
  console.log(`Messages (indexable):     ${report.indexableMessages}`);
  console.log(`messages_fts rows:        ${report.ftsRows}`);
  console.log(`Distinct message_ids:     ${report.distinctMessageIds}`);
  console.log(`Orphan rows:              ${report.orphanRows}`);
  console.log(`Duplicate message_ids:    ${report.duplicateMessageIds}`);
  console.log(`Duplicate extra rows:     ${report.duplicateExtraRows}`);
  console.log(`Rows per message ratio:   ${report.rowsPerMessageRatio}`);
  console.log(`Indexed coverage ratio:   ${report.indexedCoverageRatio}`);
  console.log('');
  console.log(`Integrity check: ${report.passes ? 'PASS' : 'FAIL'}`);

  if (report.topDuplicates.length > 0) {
    console.log('');
    console.log('Top duplicate message_ids:');
    report.topDuplicates.forEach((row) => {
      console.log(`  - ${row.message_id}: ${row.count}`);
    });
  }
}

function main() {
  const strict = !hasFlag('--no-strict');
  const asJson = hasFlag('--json');
  const dbPath = resolveDbPath();
  const report = buildReport(dbPath);
  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printReport(report);
  }

  if (strict && !report.passes) {
    process.exit(1);
  }
}

main();
