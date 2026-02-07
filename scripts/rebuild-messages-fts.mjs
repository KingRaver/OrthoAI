#!/usr/bin/env node

import fs from 'fs';
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
  return execFileSync('/usr/bin/sqlite3', ['-cmd', '.timeout 5000', dbPath, sql], {
    encoding: 'utf8',
  }).trim();
}

function runSqlStrict(dbPath, sql) {
  execFileSync('/usr/bin/sqlite3', ['-cmd', '.timeout 5000', dbPath, sql], {
    encoding: 'utf8',
  });
}

function quoteSqlLiteral(value) {
  return `'${value.replace(/'/g, "''")}'`;
}

function getCount(dbPath, sql) {
  const raw = runSql(dbPath, sql);
  const parsed = Number.parseInt(raw || '0', 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function collectSnapshot(dbPath) {
  const indexableMessages = getCount(
    dbPath,
    "SELECT COUNT(*) AS count FROM messages WHERE role IN ('user', 'assistant')"
  );
  const ftsRows = getCount(dbPath, 'SELECT COUNT(*) AS count FROM messages_fts');
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

  return {
    indexableMessages,
    ftsRows,
    distinctMessageIds,
    orphanRows,
    duplicateExtraRows,
  };
}

function backupDatabase(dbPath) {
  const backupDir = path.join(path.dirname(dbPath), 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `orthoai-fts-rebuild-${stamp}.db`);
  runSqlStrict(dbPath, `.backup ${quoteSqlLiteral(backupPath)}`);
  return backupPath;
}

function printSnapshot(label, snap) {
  const ratio =
    snap.distinctMessageIds > 0
      ? Number((snap.ftsRows / snap.distinctMessageIds).toFixed(4))
      : 0;
  console.log(label);
  console.log(`  indexable messages:  ${snap.indexableMessages}`);
  console.log(`  messages_fts rows:   ${snap.ftsRows}`);
  console.log(`  distinct message_id: ${snap.distinctMessageIds}`);
  console.log(`  orphan rows:         ${snap.orphanRows}`);
  console.log(`  duplicate extra:     ${snap.duplicateExtraRows}`);
  console.log(`  rows/message ratio:  ${ratio}`);
}

async function main() {
  const dbPath = resolveDbPath();
  const skipBackup = hasFlag('--no-backup');
  console.log(`Rebuilding messages_fts in: ${dbPath}`);

  if (!skipBackup) {
    const backupPath = backupDatabase(dbPath);
    console.log(`Backup created: ${backupPath}`);
  }

  const before = collectSnapshot(dbPath);
  printSnapshot('Before rebuild', before);

  runSqlStrict(
    dbPath,
    `PRAGMA busy_timeout = 5000;
     BEGIN IMMEDIATE;
     DELETE FROM messages_fts;
     INSERT INTO messages_fts(message_id, conversation_id, content, role)
     SELECT id, conversation_id, content, role
     FROM messages
     WHERE role IN ('user', 'assistant');
     COMMIT;`
  );

  runSqlStrict(dbPath, "INSERT INTO messages_fts(messages_fts) VALUES ('optimize')");

  const after = collectSnapshot(dbPath);
  printSnapshot('After rebuild', after);

  const passes =
    after.orphanRows === 0 &&
    after.duplicateExtraRows === 0 &&
    after.distinctMessageIds === after.indexableMessages;

  if (!passes) {
    throw new Error('FTS rebuild completed but integrity checks still fail');
  }

  console.log('FTS rebuild complete: PASS');
}

main().catch((error) => {
  console.error('FTS rebuild failed:', error);
  process.exit(1);
});
