import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Express } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import { config } from './config';
import { swaggerSpec } from './config/swagger';
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import { apiRateLimiter } from './middleware/rateLimit';
import announcementsRoutes from './routes/announcements.routes';
import assignmentFeedbackRoutes from './routes/assignmentFeedback.routes';
import assignmentsRoutes from './routes/assignments.routes';
import attendanceRoutes from './routes/attendance.routes';
import authRoutes from './routes/auth.routes';
import batchesRoutes from './routes/batches.routes';
import calendarRoutes from './routes/calendar.routes';
import facilitatorAssignmentsRoutes from './routes/facilitatorAssignments.routes';
import feedbackRoutes from './routes/feedback.routes';
import healthRoutes from './routes/health.routes';
import notificationsRoutes from './routes/notifications.routes';
import resourcesRoutes from './routes/resources.routes';
import sessionFeedbackRoutes from './routes/sessionFeedback.routes';
import sessionsRoutes from './routes/sessions.routes';
import submissionsRoutes from './routes/submissions.routes';
import trainingPlansRoutes from './routes/trainingPlans.routes';
import usersRoutes from './routes/users.routes';

export function createApp(): Express {
  const app = express();

  app.set('trust proxy', 1);

  // Defaults are intentionally kept: CSP (default-src 'self'), HSTS, X-Frame-Options,
  // X-Content-Type-Options, hidePoweredBy, etc. are all sane for this app's same-origin-ish
  // asset model and don't need overriding.
  app.use(helmet());
  app.use(
    cors({
      // Strict allowlist (CORS_ORIGIN), not a wildcard — required anyway since credentials:true
      // makes browsers reject a reflected '*' origin.
      origin: config.corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE']
    })
  );
  app.use(compression());
  app.use(morgan(config.isProduction ? 'combined' : 'dev'));
  // JSON bodies are small structured payloads in this API (file bytes go through multer, not
  // JSON) — 1mb is generous headroom while still bounding worst-case memory per request.
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser(config.cookieSecret));

  // Unprefixed health check for platform load balancers / uptime monitors (Railway, Render, etc).
  app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

  // API docs disclose the full route/schema surface. Useful in dev; in production there's no
  // browser-native way to gate a doc-viewer page behind our Bearer-token auth (navigating to a
  // URL can't attach an Authorization header), so the simplest correct fix is to not serve it
  // at all — unmounted routes here just 404 via the notFound handler below.
  if (!config.isProduction) {
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
    app.get('/api/docs.json', (_req, res) => res.json(swaggerSpec));
  }
  // Mounted before the rate limiter — health checks may be polled frequently by multiple
  // monitors and shouldn't compete with real traffic for the shared limit.
  app.use('/api/health', healthRoutes);
  app.use('/api', apiRateLimiter);
  app.use('/api/auth', authRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/batches', batchesRoutes);
  app.use('/api/facilitator-assignments', facilitatorAssignmentsRoutes);
  app.use('/api/training-plans', trainingPlansRoutes);
  app.use('/api/assignments', assignmentsRoutes);
  app.use('/api/assignments', assignmentFeedbackRoutes);
  app.use('/api/submissions', submissionsRoutes);
  app.use('/api/sessions', sessionsRoutes);
  app.use('/api/sessions', sessionFeedbackRoutes);
  app.use('/api/attendance', attendanceRoutes);
  app.use('/api/resources', resourcesRoutes);
  app.use('/api/feedback', feedbackRoutes);
  app.use('/api/announcements', announcementsRoutes);
  app.use('/api/notifications', notificationsRoutes);
  app.use('/api/calendar', calendarRoutes);

  const frontendDist = path.resolve(__dirname, '../../frontend/dist');
  app.use(express.static(frontendDist));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });

  app.use('/api', notFound);
  app.use(errorHandler);

  return app;
}
