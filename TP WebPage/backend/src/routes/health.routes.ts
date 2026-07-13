import { Router } from 'express';
import { prisma } from '../prisma/client';
import { getStorageProvider } from '../services/storage';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

/**
 * @openapi
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: Readiness check — server, database, and file storage connectivity
 *     responses:
 *       200: { description: All dependencies reachable }
 *       503: { description: One or more dependencies unreachable }
 */
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const checks: Record<string, 'ok' | 'error'> = { server: 'ok' };

    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = 'ok';
    } catch {
      checks.database = 'error';
    }

    try {
      await getStorageProvider().checkConnectivity();
      checks.storage = 'ok';
    } catch {
      checks.storage = 'error';
    }

    // No connection strings, stack traces, or other internals — just pass/fail per dependency.
    const healthy = Object.values(checks).every((status) => status === 'ok');
    res.status(healthy ? 200 : 503).json({ status: healthy ? 'ok' : 'degraded', checks });
  })
);

export default router;
