import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => {
  res.json({ status: 'ok', app: 'trainee-portal' });
});

export default router;
