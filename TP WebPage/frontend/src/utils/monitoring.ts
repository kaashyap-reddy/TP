/**
 * Error-tracking integration point — disabled by default, no SDK installed.
 *
 * Every uncaught render error already flows through here (see components/ErrorBoundary.tsx), so
 * wiring up a real provider later is a one-function change, not a hunt through the codebase.
 *
 * To connect Sentry (or another provider) once you have a DSN:
 *   1. `npm install @sentry/react` (only then — not installed today, so it costs nothing until used)
 *   2. Call `Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN })` once in main.tsx, guarded by
 *      `if (import.meta.env.VITE_SENTRY_DSN)`.
 *   3. Replace the body of `reportError` below with `Sentry.captureException(error, { extra: context })`.
 */
export function reportError(_error: unknown, _context?: Record<string, unknown>): void {
  // No-op: no error-tracking provider is configured (VITE_SENTRY_DSN is unset). See comment above.
}
