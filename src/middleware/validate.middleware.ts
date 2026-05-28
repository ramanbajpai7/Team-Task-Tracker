import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../utils/errors';

/**
 * Generic Zod validation middleware.
 * 
 * Validates request body, params, or query against a Zod schema.
 * On validation failure, throws a ValidationError with a clear message.
 * 
 * Usage:
 *   router.post('/tasks', validate(createTaskSchema, 'body'), controller.create);
 *   router.get('/tasks', validate(listQuerySchema, 'query'), controller.list);
 */
export function validate(schema: ZodSchema, source: 'body' | 'params' | 'query' = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const data = schema.parse(req[source]);
      // Replace with parsed (and potentially transformed) data
      req[source] = data;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const messages = error.errors.map((e) => {
          const path = e.path.join('.');
          return path ? `${path}: ${e.message}` : e.message;
        });
        next(new ValidationError(messages.join('; ')));
      } else {
        next(error);
      }
    }
  };
}
