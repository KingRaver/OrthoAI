#!/usr/bin/env tsx
// Script to manually run database migrations
// Usage: tsx scripts/run-migration.ts

import { SQLiteStorage } from '../app/lib/memory/storage/sqlite';
import path from 'path';

async function runMigration() {
  console.log('🔄 Running database migrations...\n');

  // Initialize database (this will run all migrations)
  const dbPath = process.env.MEMORY_DB_PATH || path.join(process.cwd(), '.data', 'orthoai.db');
  const storage = new SQLiteStorage(dbPath);

  await storage.initialize();

  console.log('\n✅ Migrations completed successfully!');
  console.log('\nTo verify the changes, you can check the database at:');
  console.log(`   ${dbPath}\n`);
}

runMigration().catch(error => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});
