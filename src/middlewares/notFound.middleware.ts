import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';

/**
 * notFound — Catches any request that didn't match a registered route
 * and converts it into an operational AppError for the global error handler.
 */
const notFound = (req: Request, _res: Response, next: NextFunction): void => {
  next(new AppError(`Route ${req.method} ${req.originalUrl} not found`, 404));
};

export default notFound;