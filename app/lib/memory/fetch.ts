type FetchRetryOptions = {
  timeoutMs: number;
  retries: number;
  retryDelayMs?: number;
};

const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.name === 'AbortError' || error.name === 'TypeError';
  }
  return false;
}

export async function fetchWithTimeoutAndRetry(
  input: RequestInfo | URL,
  init: RequestInit,
  options: FetchRetryOptions
): Promise<Response> {
  const attempts = Math.max(1, options.retries + 1);
  const timeoutMs = Math.max(1000, options.timeoutMs);
  const retryDelayMs = Math.max(50, options.retryDelayMs ?? 250);

  let lastError: unknown = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
      });

      if (response.ok || !RETRYABLE_STATUS.has(response.status) || attempt === attempts - 1) {
        return response;
      }

      lastError = new Error(
        `Retryable response status ${response.status} on attempt ${attempt + 1}/${attempts}`
      );
    } catch (error) {
      lastError = error;
      if (!isRetryableError(error) || attempt === attempts - 1) {
        throw error;
      }
    } finally {
      clearTimeout(timeoutId);
    }

    const backoff = retryDelayMs * Math.pow(2, attempt);
    await sleep(backoff);
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Request failed after retries');
}
