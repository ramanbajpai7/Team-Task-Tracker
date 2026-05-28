/**
 * Custom application error class for consistent error responses.
 * 
 * All errors thrown in the application should use this class or its subclasses
 * to ensure the global error handler can format them correctly.
 * 
 * Response format:
 * {
 *   "status": 400,
 *   "code": "VALIDATION_ERROR",
 *   "message": "due_date must be a future date"
 * }
 */
export class AppError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(status: number, code: string, message: string, isOperational = true) {
    super(message);
    this.status = status;
    this.code = code;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

// ─── Pre-defined Error Factories ──────────────────────────────────────────────

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, 'VALIDATION_ERROR', message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(403, 'FORBIDDEN', message);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(404, 'NOT_FOUND', `${resource} not found`);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, 'CONFLICT', message);
  }
}

export class InvalidTransitionError extends AppError {
  constructor(from: string, to: string) {
    super(400, 'INVALID_STATUS_TRANSITION', `Cannot transition from ${from} to ${to}`);
  }
}
