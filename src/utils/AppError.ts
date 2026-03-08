/**
 * AppError — Operational errors we deliberately throw.
 * These are distinguishable from programmer errors (bugs) in the global
 * error handler, so we can respond gracefully vs crash/log differently.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly status: string;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);

    this.statusCode = statusCode;
    // 4xx → "fail" (client fault), 5xx → "error" (server fault)
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    // Preserve original stack trace, excluding this constructor frame
    Error.captureStackTrace(this, this.constructor);
  }
}