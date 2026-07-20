import * as Sentry from '@sentry/node';
import { createApp } from './app';
import { config } from './config';
import { prisma } from './prisma/client';
import { logger } from './utils/logger';
import { reportError } from './utils/monitoring';

// Must run before createApp()/anything else that could throw, and only when a DSN is actually
// configured — with none set this is skipped entirely, matching every environment's behavior today.
if (config.monitoring.sentryDsn) {
  Sentry.init({ dsn: config.monitoring.sentryDsn, environment: config.env });
}

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

const app = createApp();

const server = app.listen(PORT, () => {
  console.log(`Trainee Portal API running at http://localhost:${PORT}`);
});

// Bound how long a single request may take end-to-end (headersTimeout must exceed
// requestTimeout, per Node's docs, or the header phase can time out first).
server.requestTimeout = 30_000;
server.headersTimeout = 35_000;

function shutdown(signal: string) {
  logger.info('server.shutdown', { signal });
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  // Force-exit if connections don't drain in time.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// A rejected promise or thrown error with no handler anywhere in the call chain means some code
// path isn't going through asyncHandler/errorHandler as expected. Log it with full detail (this
// is the one place raw `err` logging is fine — it's an internal bug signal, not user-facing) and
// fail fast rather than continue running with potentially corrupted state.
process.on('unhandledRejection', (reason) => {
  logger.error('process.unhandled_rejection', { message: reason instanceof Error ? reason.message : String(reason) });
  reportError(reason, { event: 'unhandledRejection' });
});

process.on('uncaughtException', async (err) => {
  logger.error('process.uncaught_exception', { message: err.message, stack: err.stack });
  reportError(err, { event: 'uncaughtException' });
  // Sentry.captureException only enqueues the event — without this, the process can exit
  // before it's actually sent, silently losing the one report that matters most.
  if (config.monitoring.sentryDsn) await Sentry.flush(2000).catch(() => undefined);
  shutdown('uncaughtException');
});
