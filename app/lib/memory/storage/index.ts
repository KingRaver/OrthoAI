// app/lib/memory/storage/index.ts
// Storage abstraction layer - exports SQLiteStorage singleton

import { SQLiteStorage } from './sqlite';

let storageInstance: SQLiteStorage | null = null;

/**
 * Get or create SQLite storage instance (singleton)
 * Ensures only one database connection across the app
 */
export function getStorage(): SQLiteStorage {
  if (!storageInstance) {
    const dbPath = process.env.MEMORY_DB_PATH || './.data/hackerreign.db';
    storageInstance = new SQLiteStorage(dbPath);
  }
  return storageInstance;
}

/**
 * Initialize storage (call once at app startup)
 */
export async function initializeStorage(): Promise<void> {
  const storage = getStorage();
  await storage.initialize();
}

/**
 * Close storage connection
 */
export function closeStorage(): void {
  if (storageInstance) {
    storageInstance.close();
    storageInstance = null;
  }
}

export { SQLiteStorage };