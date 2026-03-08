import { PrismaClient } from '@prisma/client';
import env from './env';
import logger from '../utils/logger';

// Singleton pattern: prevents multiple Prisma Client instances during
// hot-reload in development (each instance opens its own connection pool).
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

const prisma: PrismaClient =
  global.__prisma ??
  new PrismaClient({
    log:
      env.NODE_ENV === 'development'
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'event', level: 'error' },
            { emit: 'event', level: 'warn' },
          ]
        : [{ emit: 'event', level: 'error' }],
  });

// Log SQL queries only in development
if (env.NODE_ENV === 'development') {
  (prisma as PrismaClient & {
    $on: (event: string, cb: (e: { query: string; duration: number }) => void) => void;
  }).$on('query', (e) => {
    logger.debug(`Query: ${e.query} | Duration: ${e.duration}ms`);
  });
}

if (env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

export default prisma;