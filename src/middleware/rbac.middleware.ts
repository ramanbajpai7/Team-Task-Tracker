import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';

/**
 * Role-Based Access Control (RBAC) middleware.
 * 
 * This middleware is applied at the ROUTE LEVEL, not inside controllers.
 * Per the assignment spec: "RBAC must be enforced at the middleware level,
 * not inside controller logic."
 * 
 * Usage in routes:
 *   router.get('/users', authenticate, authorize(Role.ADMIN), controller.list);
 *   router.post('/tasks', authenticate, authorize(Role.ADMIN, Role.MANAGER), controller.create);
 * 
 * @param allowedRoles - Roles that are permitted to access the endpoint
 */
export function authorize(...allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    const userRole = req.user.role as Role;

    if (!allowedRoles.includes(userRole)) {
      return next(
        new ForbiddenError(
          `Role '${userRole}' is not authorized to access this resource. Required: ${allowedRoles.join(', ')}`
        )
      );
    }

    next();
  };
}
