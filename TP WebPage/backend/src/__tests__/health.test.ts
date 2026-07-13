import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryRaw = vi.fn();
const checkConnectivity = vi.fn();

vi.mock('../prisma/client', () => ({
  prisma: { $queryRaw: (...args: unknown[]) => queryRaw(...args) }
}));

vi.mock('../services/storage', () => ({
  getStorageProvider: () => ({ checkConnectivity: (...args: unknown[]) => checkConnectivity(...args) })
}));

describe('GET /health (readiness)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with all checks ok when every dependency is reachable', async () => {
    queryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);
    checkConnectivity.mockResolvedValueOnce(undefined);

    const healthRoutes = (await import('../routes/health.routes')).default;
    const app = express();
    app.use('/health', healthRoutes);

    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', checks: { server: 'ok', database: 'ok', storage: 'ok' } });
  });

  it('returns 503 with per-dependency detail (no internals) when the database is unreachable', async () => {
    queryRaw.mockRejectedValueOnce(new Error('connection refused to postgres at some-internal-host:5432'));
    checkConnectivity.mockResolvedValueOnce(undefined);

    const healthRoutes = (await import('../routes/health.routes')).default;
    const app = express();
    app.use('/health', healthRoutes);

    const res = await request(app).get('/health');
    expect(res.status).toBe(503);
    expect(res.body.checks.database).toBe('error');
    // The response must never leak the underlying error message/connection details.
    expect(JSON.stringify(res.body)).not.toMatch(/postgres|connection refused|5432/);
  });

  it('returns 503 when storage is unreachable even if the database is fine', async () => {
    queryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);
    checkConnectivity.mockRejectedValueOnce(new Error('bucket not found'));

    const healthRoutes = (await import('../routes/health.routes')).default;
    const app = express();
    app.use('/health', healthRoutes);

    const res = await request(app).get('/health');
    expect(res.status).toBe(503);
    expect(res.body.checks.storage).toBe('error');
  });
});
