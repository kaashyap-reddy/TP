/**
 * Error-tracking integration point — disabled by default, no SDK installed.
 *
 * Every unexpected server error already flows through here (see middleware/errorHandler.ts),
 * so wiring up a real provider later is a one-function change, not a hunt through the codebase.
 *
 * To connect Sentry (or another provider) once you have a DSN:
 *   1. `npm install @sentry/node` (only then — not installed today, so it costs nothing until used)
 *   2. Call `Sentry.init({ dsn: config.monitoring.sentryDsn })` once at startup in src/index.ts,
 *      guarded by `if (config.monitoring.sentryDsn)`.
 *   3. Replace the body of `reportError` below with `Sentry.captureException(err, { extra: context })`.
 *
 * Until then this just confirms an error occurred and was already captured by the structured
 * logger — it deliberately does not duplicate that log line.
 */
export function reportError(_err: unknown, _context?: Record<string, unknown>): void {
  // No-op: no error-tracking provider is configured (SENTRY_DSN is unset). See comment above.
}
