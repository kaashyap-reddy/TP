import express from 'express';
import request from 'supertest';
import rateLimit from 'express-rate-limit';
import { describe, expect, it } from 'vitest';

function appWithLimiter(limit: number) {
  const app = express();
  app.use(rateLimit({ windowMs: 60_000, limit, standardHeaders: true, legacyHeaders: false }));
  app.post('/probe', (_req, res) => res.status(200).json({ ok: true }));
  return app;
}

describe('rate limiting', () => {
  it('allows requests under the limit', async () => {
    const app = appWithLimiter(3);
    for (let i = 0; i < 3; i++) {
      const res = await request(app).post('/probe');
      expect(res.status).toBe(200);
    }
  });

  it('blocks requests once the limit is exceeded', async () => {
    const app = appWithLimiter(3);
    for (let i = 0; i < 3; i++) {
      await request(app).post('/probe');
    }
    const res = await request(app).post('/probe');
    expect(res.status).toBe(429);
  });
});
