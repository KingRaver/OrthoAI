/**
 * Next.js Instrumentation Hook
 * Runs once at server startup to configure global settings
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Configure undici (used by Next.js fetch) to have no timeouts
    // This prevents HeadersTimeoutError for long-running LLM requests
    const { setGlobalDispatcher, Agent } = await import('undici');

    setGlobalDispatcher(
      new Agent({
        // Remove all timeout restrictions
        headersTimeout: 0, // 0 = no timeout
        bodyTimeout: 0,    // 0 = no timeout
        connectTimeout: 0, // 0 = no timeout

        // Keep connections alive
        keepAliveTimeout: 600000, // 10 minutes
        keepAliveMaxTimeout: 600000,

        // Connection pool settings
        connections: 100,
        pipelining: 10,
      })
    );

    console.log('[Instrumentation] Undici configured with no timeouts for long-running LLM requests');
  }
}
