/**
 * Next.js Instrumentation Hook
 * Runs once at server startup to configure global settings
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Configure undici (used by Next.js fetch) with bounded timeouts
    const { setGlobalDispatcher, Agent } = await import('undici');
    const { getLlmRequestTimeoutMs } = await import('./app/lib/llm/config');
    const requestTimeoutMs = getLlmRequestTimeoutMs();

    setGlobalDispatcher(
      new Agent({
        headersTimeout: requestTimeoutMs,
        bodyTimeout: requestTimeoutMs,
        connectTimeout: Math.min(30000, requestTimeoutMs),

        // Keep connections alive
        keepAliveTimeout: Math.min(600000, requestTimeoutMs),
        keepAliveMaxTimeout: Math.min(600000, requestTimeoutMs),

        // Connection pool settings
        connections: 100,
        pipelining: 10,
      })
    );

    console.log(`[Instrumentation] Undici configured with bounded timeouts (${requestTimeoutMs}ms)`);
  }
}
