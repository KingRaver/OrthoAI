/**
 * Next.js Instrumentation Hook
 * Runs once at server startup to configure global settings
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { logger } = await import('./app/lib/system/logger');

    // Configure undici (used by Next.js fetch) with bounded timeouts
    const { setGlobalDispatcher, Agent } = await import('undici');
    const { getLlmRequestTimeoutMs } = await import('./app/lib/llm/config');
    const { initializeMemory, getMemoryManager, closeStorage } = await import('./app/lib/memory');
    const { installShutdownHandlers, registerShutdownHandler } = await import('./app/lib/system/shutdownRegistry');
    const { disposeSttServiceIfInitialized } = await import('./app/lib/voice/server/sttService');
    const { disposePiperServiceIfInitialized } = await import('./app/lib/voice/server/piperService');
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

    installShutdownHandlers();
    registerShutdownHandler('memory', async () => {
      const memory = getMemoryManager();
      await memory.waitForBackgroundIdle(5000);
      closeStorage();
    });
    registerShutdownHandler('voice-stt', () => {
      disposeSttServiceIfInitialized();
    });
    registerShutdownHandler('voice-piper', () => {
      disposePiperServiceIfInitialized();
    });

    try {
      await initializeMemory();
      logger.info('Startup initialization complete', { requestTimeoutMs }, 'instrumentation');
    } catch (error) {
      logger.warn('Startup initialization degraded', {
        requestTimeoutMs,
        error: error instanceof Error ? error.message : String(error),
      }, 'instrumentation');
    }
  }
}
