/**
 * Minimal structured (JSON) logger — no new dependency. Every call emits one JSON line to
 * stdout/stderr so log aggregators (Railway/Render's built-in log views, or anything reading
 * stdout) can parse fields instead of grepping free text.
 *
 * NEVER pass passwords, JWTs, refresh tokens, secrets, or full request bodies in `meta`.
 */
type Level = 'info' | 'warn' | 'error';

interface LogMeta {
  [key: string]: unknown;
}

function emit(level: Level, event: string, meta?: LogMeta): void {
  const line = JSON.stringify({
    level,
    event,
    time: new Date().toISOString(),
    env: process.env.NODE_ENV,
    ...meta
  });
  if (level === 'error') {
    console.error(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  info: (event: string, meta?: LogMeta) => emit('info', event, meta),
  warn: (event: string, meta?: LogMeta) => emit('warn', event, meta),
  error: (event: string, meta?: LogMeta) => emit('error', event, meta)
};
