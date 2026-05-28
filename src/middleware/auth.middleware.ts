import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { UnauthorizedError } from '../utils/errors';

/**
 * JWT payload shape attached to authenticated requests.
 */
export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  organizationId: string;
}

/**
 * Extend Express Request to include authenticated user data.
 */
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Authentication middleware.
 * 
 * Extracts the JWT access token from the Authorization header,
 * verifies it, and attaches the decoded payload to `req.user`.
 * 
 * Must be applied before any route that requires authentication.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid authorization header');
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      throw new UnauthorizedError('Token not provided');
    }

    const decoded = jwt.verify(token, config.jwt.accessSecret) as JwtPayload;

    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      organizationId: decoded.organizationId,
    };

    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      next(error);
    } else if (error instanceof jwt.TokenExpiredError) {
      next(new UnauthorizedError('Access token expired'));
    } else if (error instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError('Invalid access token'));
    } else {
      next(new UnauthorizedError('Authentication failed'));
    }
  }
}
