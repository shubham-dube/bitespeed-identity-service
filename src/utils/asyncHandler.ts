import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * asyncHandler — Wraps an async route handler so that any rejected promise
 * or thrown error is forwarded to Express's next(err) error pipeline,
 * instead of causing an unhandled promise rejection.
 *
 * Usage:
 *   router.post('/identify', asyncHandler(contactController.identify));
 */
const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>): RequestHandler =>
  (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };

export default asyncHandler;