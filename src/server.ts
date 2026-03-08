import 'dotenv/config';
import app from './app';
import env from './config/env';
import prisma from './config/database';
import logger from './utils/logger';

const startServer = async (): Promise<void> => {
  try {
    // Verify DB connection before accepting traffic
    await prisma.$connect();
    logger.info('✅ Database connected successfully');

    const server = app.listen(env.PORT, () => {
      logger.info(`🚀 Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
      logger.info(`📍 Identify endpoint: POST http://localhost:${env.PORT}${env.API_PREFIX}/identify`);
    });

    // ── Graceful shutdown ─────────────────────────────────────────────────────
    const shutdown = async (signal: string): Promise<void> => {
      logger.info(`${signal} received — shutting down gracefully`);
      server.close(async () => {
        await prisma.$disconnect();
        logger.info('💤 DB disconnected. Server closed.');
        process.exit(0);
      });

      // Force kill after 10s if graceful shutdown stalls
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10_000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // ── Unhandled rejections / exceptions ────────────────────────────────────
    process.on('unhandledRejection', (reason: unknown) => {
      logger.error('Unhandled Rejection:', reason);
      process.exit(1);
    });

    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
};

startServer();