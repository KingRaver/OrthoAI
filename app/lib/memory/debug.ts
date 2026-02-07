const DEBUG_MEMORY =
  process.env.DEBUG_MEMORY === 'true' || process.env.DEBUG_METRICS === 'true';

export function isMemoryDebugEnabled(): boolean {
  return DEBUG_MEMORY;
}

export function memoryDebug(...args: unknown[]): void {
  if (isMemoryDebugEnabled()) {
    console.log(...args);
  }
}
