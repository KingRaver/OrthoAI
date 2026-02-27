import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchWithTimeoutAndRetry } from '@/app/lib/memory/fetch';

describe('fetchWithTimeoutAndRetry', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('retries on retryable HTTP statuses and eventually succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('upstream issue', { status: 503, statusText: 'Service Unavailable' }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));

    vi.stubGlobal('fetch', fetchMock);

    const response = await fetchWithTimeoutAndRetry(
      'https://example.com',
      { method: 'GET' },
      { timeoutMs: 1000, retries: 1, retryDelayMs: 1 }
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries on rate-limit status 429 and succeeds on next attempt', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('rate limited', { status: 429 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));

    vi.stubGlobal('fetch', fetchMock);

    const response = await fetchWithTimeoutAndRetry(
      'https://example.com',
      { method: 'POST' },
      { timeoutMs: 1000, retries: 1, retryDelayMs: 1 }
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-retryable HTTP status 400', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('bad request', { status: 400 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await fetchWithTimeoutAndRetry(
      'https://example.com',
      { method: 'GET' },
      { timeoutMs: 1000, retries: 3, retryDelayMs: 1 }
    );

    expect(response.status).toBe(400);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry non-retryable HTTP status 401', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('unauthorized', { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await fetchWithTimeoutAndRetry(
      'https://example.com',
      { method: 'GET' },
      { timeoutMs: 1000, retries: 3, retryDelayMs: 1 }
    );

    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries on retryable fetch errors like TypeError', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('network failure'))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));

    vi.stubGlobal('fetch', fetchMock);

    const response = await fetchWithTimeoutAndRetry(
      'https://example.com',
      { method: 'POST', body: '{}' },
      { timeoutMs: 1000, retries: 1, retryDelayMs: 1 }
    );

    expect(response.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries on AbortError and succeeds on next attempt', async () => {
    const abortError = new Error('signal aborted');
    abortError.name = 'AbortError';

    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(abortError)
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));

    vi.stubGlobal('fetch', fetchMock);

    const response = await fetchWithTimeoutAndRetry(
      'https://example.com',
      { method: 'GET' },
      { timeoutMs: 1000, retries: 1, retryDelayMs: 1 }
    );

    expect(response.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('exhausts all retries on persistent TypeError and re-throws last error', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('persistent network error'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      fetchWithTimeoutAndRetry(
        'https://example.com',
        { method: 'GET' },
        { timeoutMs: 1000, retries: 2, retryDelayMs: 1 }
      )
    ).rejects.toThrow('persistent network error');

    // retries: 2 means 3 total attempts (1 initial + 2 retries)
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('throws immediately for non-retryable fetch errors', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('boom'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      fetchWithTimeoutAndRetry(
        'https://example.com',
        { method: 'GET' },
        { timeoutMs: 1000, retries: 2, retryDelayMs: 1 }
      )
    ).rejects.toThrow('boom');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
