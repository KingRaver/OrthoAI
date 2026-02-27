import { describe, expect, it, vi } from 'vitest';

describe('memory ops counters', () => {
  it('records success and failures with normalized messages', async () => {
    vi.resetModules();
    const ops = await import('@/app/lib/memory/ops');

    ops.recordMemorySuccess('summary');
    ops.recordMemorySuccess('summary');
    ops.recordMemoryFailure('summary', 'unit-test', new Error('failed summary'));
    ops.recordMemoryFailure('embedding', 'unit-test', 'raw string error');

    const snapshot = ops.getMemoryOpsSnapshot(10);

    expect(snapshot.counters.summary.success).toBe(2);
    expect(snapshot.counters.summary.failure).toBe(1);
    expect(snapshot.counters.embedding.failure).toBe(1);
    // Category isolation: summary success must not bleed into embedding
    expect(snapshot.counters.embedding.success).toBe(0);

    // Failures are returned newest-first
    expect(snapshot.recentFailures[0].message).toBe('raw string error');
    expect(snapshot.recentFailures[1].message).toBe('failed summary');

    // Failure metadata integrity
    expect(snapshot.recentFailures[0].category).toBe('embedding');
    expect(snapshot.recentFailures[1].category).toBe('summary');
    expect(snapshot.recentFailures[0].id).toMatch(/^memfail_/);
    expect(snapshot.recentFailures[0].source).toBe('unit-test');
    expect(snapshot.timestamp).toBeTruthy();
  });

  it('normalizes Error instances and raw strings to message field', async () => {
    vi.resetModules();
    const ops = await import('@/app/lib/memory/ops');

    ops.recordMemoryFailure('retrieval', 'test', new Error('error object message'));
    ops.recordMemoryFailure('retrieval', 'test', 'plain string message');
    ops.recordMemoryFailure('retrieval', 'test', { code: 42 }); // unknown type

    const snapshot = ops.getMemoryOpsSnapshot(10);
    const messages = snapshot.recentFailures.map(f => f.message);

    // Error instance: .message extracted
    expect(messages).toContain('error object message');
    // String: used directly
    expect(messages).toContain('plain string message');
    // Unknown: stringified (at minimum, must not throw)
    expect(messages.length).toBe(3);
  });

  it('caps failure history at 100 items and enforces snapshot limit bounds', async () => {
    vi.resetModules();
    const ops = await import('@/app/lib/memory/ops');

    for (let i = 0; i < 120; i += 1) {
      ops.recordMemoryFailure('retrieval', 'load-test', new Error(`err-${i}`));
    }

    const clampedHigh = ops.getMemoryOpsSnapshot(500);
    const clampedLow = ops.getMemoryOpsSnapshot(0);

    expect(clampedHigh.recentFailures).toHaveLength(100);
    expect(clampedHigh.recentFailures[0].message).toBe('err-119');
    expect(clampedHigh.recentFailures[99].message).toBe('err-20');
    // Limit 0 is clamped to minimum of 1
    expect(clampedLow.recentFailures).toHaveLength(1);
  });
});
