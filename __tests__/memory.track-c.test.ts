// @vitest-environment node

import fs from 'fs';
import os from 'os';
import path from 'path';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import {
  MemoryManager,
  initializeStorage,
  resetMemoryManagerForTests,
} from '@/app/lib/memory';

type MockResponse = {
  ok: boolean;
  status: number;
  statusText: string;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
};

function summaryResponse(summary: string): Response {
  const body = {
    choices: [{ message: { content: summary } }],
  };
  const mock: MockResponse = {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
  return mock as unknown as Response;
}

function removeDbArtifacts(dbPath: string): void {
  for (const filePath of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
    try {
      fs.rmSync(filePath, { force: true });
    } catch {
      // Ignore cleanup errors in tests
    }
  }
}

function mockRag(manager: MemoryManager): void {
  const rag = (manager as unknown as { rag: Record<string, (...args: unknown[]) => unknown> }).rag;
  vi.spyOn(rag, 'processMessageForRAG').mockResolvedValue(undefined);
  vi.spyOn(rag, 'upsertConversationSummaryEmbedding').mockResolvedValue(undefined);
  vi.spyOn(rag, 'upsertUserProfileEmbedding').mockResolvedValue(undefined);
  vi.spyOn(rag, 'deleteUserProfileEmbedding').mockResolvedValue(undefined);
}

describe('Track C summary/profile reliability', () => {
  let dbPath = '';

  beforeEach(async () => {
    dbPath = path.join(
      os.tmpdir(),
      `orthoai-track-c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.db`
    );
    process.env.MEMORY_DB_PATH = dbPath;
    process.env.RAG_SUMMARY_FREQUENCY = '2';
    process.env.SUMMARY_REQUEST_RETRIES = '0';
    process.env.SUMMARY_REQUEST_TIMEOUT_MS = '1000';
    process.env.SUMMARY_JOB_MAX_ATTEMPTS = '2';
    process.env.SUMMARY_RETRY_BASE_DELAY_MS = '10';
    process.env.SUMMARY_QUEUE_MAX_DEPTH = '8';
    process.env.SUMMARY_CIRCUIT_BREAKER_FAILURE_THRESHOLD = '3';
    process.env.SUMMARY_CIRCUIT_BREAKER_COOLDOWN_MS = '1000';

    await initializeStorage();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    resetMemoryManagerForTests();
    removeDbArtifacts(dbPath);
    delete process.env.MEMORY_DB_PATH;
  });

  it('persists summary after N assistant turns and remains after manager restart', async () => {
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(summaryResponse('Conversation focused on tendon healing and trial design.'));

    const manager = new MemoryManager();
    mockRag(manager);
    await manager.updateProfileConsent(true);
    const conversation = manager.createConversation('Summary persistence');

    await manager.saveMessage(conversation.id, 'assistant', 'First assistant turn');
    await manager.saveMessage(conversation.id, 'assistant', 'Second assistant turn triggers summary');

    const drained = await manager.waitForBackgroundIdle(2000);
    expect(drained).toBe(true);

    const summary = manager.getConversationSummary(conversation.id);
    expect(summary?.summary).toContain('tendon healing');

    const health = manager.getSummaryHealth(conversation.id);
    expect(health?.last_state).toBe('succeeded');
    expect(health?.total_runs).toBeGreaterThanOrEqual(1);
    expect(health?.total_successes).toBeGreaterThanOrEqual(1);

    resetMemoryManagerForTests();
    process.env.MEMORY_DB_PATH = dbPath;
    await initializeStorage();
    const restarted = new MemoryManager();
    mockRag(restarted);
    const persistedSummary = restarted.getConversationSummary(conversation.id);
    expect(persistedSummary?.summary).toContain('tendon healing');
  });

  it('recovers from transient summary failure using retry and backoff', async () => {
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock
      .mockRejectedValueOnce(new TypeError('upstream timeout'))
      .mockResolvedValueOnce(summaryResponse('Recovered summary after retry.'));

    const manager = new MemoryManager();
    mockRag(manager);
    await manager.updateProfileConsent(true);
    const conversation = manager.createConversation('Retry flow');

    await manager.saveMessage(conversation.id, 'assistant', 'Attempt one');
    await manager.saveMessage(conversation.id, 'assistant', 'Attempt two');

    const drained = await manager.waitForBackgroundIdle(2500);
    expect(drained).toBe(true);

    const summary = manager.getConversationSummary(conversation.id);
    expect(summary?.summary).toContain('Recovered summary');

    const health = manager.getSummaryHealth(conversation.id);
    expect(health?.total_runs).toBeGreaterThanOrEqual(2);
    expect(health?.total_failures).toBeGreaterThanOrEqual(1);
    expect(health?.total_successes).toBeGreaterThanOrEqual(1);
    expect(health?.total_retries).toBeGreaterThanOrEqual(1);
    expect(health?.consecutive_failures).toBe(0);
    expect(health?.last_state).toBe('succeeded');
  });

  it('on consent revocation clears profile and excludes profile retrieval context', async () => {
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(summaryResponse('Should not be written after consent revocation.'));

    const manager = new MemoryManager();
    mockRag(manager);
    await manager.updateProfileConsent(true);
    await manager.saveUserProfile('role: researcher\nfocus: tendon repair', true);

    const includeProfileArgs: boolean[] = [];
    const rag = (manager as unknown as { rag: { augmentPrompt: (...args: unknown[]) => Promise<unknown> } }).rag;
    const ragWithTypedAugment = rag as {
      augmentPrompt: (
        query: string,
        topK: number,
        conversationId?: string,
        includeProfile?: boolean
      ) => Promise<unknown>;
    };
    vi.spyOn(ragWithTypedAugment, 'augmentPrompt').mockImplementation(
      async (...args: [string, number, string | undefined, boolean | undefined]) => {
        includeProfileArgs.push(Boolean(args[3]));
        return {
          original_query: String(args[0] ?? ''),
          retrieved_context: [],
          enhanced_system_prompt: 'test',
        };
      }
    );

    const conversation = manager.createConversation('Consent revocation');
    await manager.augmentWithMemory('before revoke', 3, conversation.id);
    expect(includeProfileArgs[0]).toBe(true);

    await manager.updateProfileConsent(false);
    expect(manager.isProfileConsentGranted()).toBe(false);
    expect(manager.getUserProfile()).toBeNull();

    await manager.augmentWithMemory('after revoke', 3, conversation.id);
    expect(includeProfileArgs[1]).toBe(false);

    await manager.saveMessage(conversation.id, 'assistant', 'Assistant turn one');
    await manager.saveMessage(conversation.id, 'assistant', 'Assistant turn two should skip summary');
    await manager.waitForBackgroundIdle(2000);

    expect(manager.getConversationSummary(conversation.id)).toBeNull();
    const health = manager.getSummaryHealth(conversation.id);
    expect(health?.last_state).toBe('skipped_no_consent');
  });
});
