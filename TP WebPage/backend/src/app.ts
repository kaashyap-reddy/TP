import cors from 'cors';
import express, { Express } from 'express';
import path from 'path';
import authRoutes from './routes/auth.routes';
import healthRoutes from './routes/health.routes';
import { errorHandler } from './middleware/errorHandler';

export function createApp(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use('/api/health', healthRoutes);
  app.use('/api/auth', authRoutes);

  const frontendDist = path.resolve(__dirname, '../../frontend/dist');
  app.use(express.static(frontendDist));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });

  app.use(errorHandler);

  return app;
}
