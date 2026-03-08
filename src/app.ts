import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import 'dotenv/config';

import env from './config/env';
import router from './routes/index';
import rateLimiter from './middlewares/rateLimiter.middleware';
import notFound from './middlewares/notFound.middleware';
import globalErrorHandler from './middlewares/errorHandler.middleware';

const app: Application = express();

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: env.CORS_ORIGIN === '*' ? '*' : env.CORS_ORIGIN.split(','),
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// ── Rate limiting (applied globally before any route) ─────────────────────────
app.use(rateLimiter);

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));         // Prevent huge payload attacks
app.use(express.urlencoded({ extended: true }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use(env.API_PREFIX, router);

// ── 404 handler (must be after all routes) ───────────────────────────────────
app.use(notFound);

// ── Global error handler (must be last, 4-arg signature) ─────────────────────
app.use(globalErrorHandler);

export default app;