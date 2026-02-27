type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogPayload = {
  ts: string;
  level: LogLevel;
  message: string;
  component?: string;
  [key: string]: unknown;
};

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function parseLogLevel(raw: string | undefined): LogLevel {
  const value = (raw || 'info').toLowerCase();
  if (value === 'debug' || value === 'info' || value === 'warn' || value === 'error') {
    return value;
  }
  return 'info';
}

const MIN_LEVEL = parseLogLevel(process.env.LOG_LEVEL);

function shouldLog(level: LogLevel): boolean {
  const debugEnabled = process.env.DEBUG === 'true' || process.env.DEBUG_METRICS === 'true';
  if (debugEnabled) return true;
  return LEVEL_ORDER[level] >= LEVEL_ORDER[MIN_LEVEL];
}

function writeLog(level: LogLevel, payload: LogPayload): void {
  const text = JSON.stringify(payload);
  if (level === 'error') {
    console.error(text);
    return;
  }
  if (level === 'warn') {
    console.warn(text);
    return;
  }
  if (level === 'info') {
    console.info(text);
    return;
  }
  console.debug(text);
}

export function log(
  level: LogLevel,
  message: string,
  details?: Record<string, unknown>,
  component?: string
): void {
  if (!shouldLog(level)) return;
  const payload: LogPayload = {
    ts: new Date().toISOString(),
    level,
    message,
    ...(component ? { component } : {}),
    ...(details || {}),
  };
  writeLog(level, payload);
}

export const logger = {
  debug: (message: string, details?: Record<string, unknown>, component?: string) =>
    log('debug', message, details, component),
  info: (message: string, details?: Record<string, unknown>, component?: string) =>
    log('info', message, details, component),
  warn: (message: string, details?: Record<string, unknown>, component?: string) =>
    log('warn', message, details, component),
  error: (message: string, details?: Record<string, unknown>, component?: string) =>
    log('error', message, details, component),
};

export type { LogLevel };
