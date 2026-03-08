import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import logger from '../utils/logger';
import env from '../config/env';

interface ErrorResponse {
  status: string;
  message: string;
  stack?: string;
}

/**
 * Handles Prisma-specific errors and converts them to AppErrors.
 */
const handlePrismaError = (err: { code?: string; meta?: { target?: string[] } }): AppError => {
  switch (err.code) {
    case 'P2002':
      return new AppError(
        `Duplicate field value: ${err.meta?.target?.join(', ')}`,
        409,
      );
    case 'P2025':
      return new AppError('Record not found', 404);
    case 'P2003':
      return new AppError('Foreign key constraint failed', 400);
    default:
      return new AppError('Database error occurred', 500);
  }
};

/**
 * globalErrorHandler — The single place where ALL errors end up.
 * Differentiates between:
 *   1. Operational errors  (AppError) → safe to expose message to client
 *   2. Prisma errors       → map to AppError
 *   3. Programming errors  → log fully, send generic 500
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const globalErrorHandler = (
  err: Error & { code?: string; statusCode?: number; isOperational?: boolean; meta?: { target?: string[] } },
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  // Default to 500
  let error = err;

  // ── Prisma known errors ───────────────────────────────────────
  if (err.code?.startsWith('P')) {
    error = handlePrismaError(err);
  }

  // ── Operational (known) errors ────────────────────────────────
  if (error instanceof AppError && error.isOperational) {
    logger.warn(`[${req.method}] ${req.originalUrl} → ${error.statusCode}: ${error.message}`);

    const response: ErrorResponse = {
      status: error.status,
      message: error.message,
    };

    if (env.NODE_ENV === 'development') {
      response.stack = error.stack;
    }

    res.status(error.statusCode).json(response);
    return;
  }

  // ── Unknown / programmer errors ───────────────────────────────
  logger.error('UNHANDLED ERROR:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
  });

  const response: ErrorResponse = {
    status: 'error',
    message: 'Something went wrong. Please try again later.',
  };

  if (env.NODE_ENV === 'development') {
    response.message = err.message;
    response.stack = err.stack;
  }

  res.status(500).json(response);
};

export default globalErrorHandler;