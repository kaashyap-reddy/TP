import * as Sentry from '@sentry/react';

/**
 * Error-tracking integration point. `Sentry.init()` runs once at startup (see main.tsx), guarded
 * by `VITE_SENTRY_DSN` — with no DSN set, `init` never runs and `captureException` is a documented
 * no-op, so this stays inert in every environment until a real DSN is provided. Every uncaught
 * render error already flows through here (see components/ErrorBoundary.tsx).
 */
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  if (!import.meta.env.VITE_SENTRY_DSN) return;
  Sentry.captureException(error, { extra: context });
}
