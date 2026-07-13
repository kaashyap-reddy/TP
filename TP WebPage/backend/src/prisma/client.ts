import { PrismaClient } from '@prisma/client';
import { config } from '../config';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ??
  new PrismaClient({
    log: config.isProduction ? ['error'] : ['warn', 'error']
  });

if (!config.isProduction) {
  global.__prisma = prisma;
}
