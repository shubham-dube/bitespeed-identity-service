import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

/**
 * validate — Factory that returns a middleware which validates req.body
 * against the provided Zod schema. On failure it responds 400 with the
 * first validation error; on success it calls next().
 */
const validate =
  (schema: ZodSchema) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const error = result.error as ZodError;
      const message = error.errors.map((e) => e.message).join(', ');
      res.status(400).json({
        status: 'fail',
        message,
      });
      return;
    }

    // Replace body with the parsed (and possibly coerced/trimmed) value
    req.body = result.data;
    next();
  };

export default validate;