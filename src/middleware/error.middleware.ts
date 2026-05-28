import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';

/**
 * Global error handler middleware.
 * 
 * Catches all errors and formats them into a consistent response:
 * {
 *   "status": 400,
 *   "code": "VALIDATION_ERROR",
 *   "message": "due_date must be a future date"
 * }
 * 
 * Must be registered LAST in the middleware chain.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Handle known operational errors
  if (err instanceof AppError) {
    res.status(err.status).json({
      status: err.status,
      code: err.code,
      message: err.message,
    });
    return;
  }

  // Handle unexpected errors
  console.error('Unhandled error:', err);

  res.status(500).json({
    status: 500,
    code: 'INTERNAL_SERVER_ERROR',
    message:
      process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : err.message || 'An unexpected error occurred',
  });
}
