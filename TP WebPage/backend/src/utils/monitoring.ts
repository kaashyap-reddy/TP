import * as Sentry from '@sentry/node';
import { config } from '../config';

/**
 * Error-tracking integration point. `Sentry.init()` is called once at startup (see index.ts),
 * guarded by `config.monitoring.sentryDsn` — with no DSN set, `init` never runs and every
 * Sentry.* call below is a documented no-op, so this remains inert in every environment until
 * a real SENTRY_DSN is provided. Every unexpected server error already flows through here (see
 * middleware/errorHandler.ts) plus the process-level crash handlers in index.ts.
 */
export function reportError(err: unknown, context?: Record<string, unknown>): void {
  if (!config.monitoring.sentryDsn) return;
  Sentry.captureException(err, { extra: context });
}
