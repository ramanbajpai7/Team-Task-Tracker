import { z } from 'zod';

/**
 * Schema for creating a user (ADMIN adds members to their org).
 */
export const createUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  name: z.string().min(1, 'Name is required').max(100),
  role: z.enum(['ADMIN', 'MANAGER', 'MEMBER'], {
    errorMap: () => ({ message: 'Role must be ADMIN, MANAGER, or MEMBER' }),
  }),
});

/**
 * Schema for updating a user.
 */
export const updateUserSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    role: z
      .enum(['ADMIN', 'MANAGER', 'MEMBER'], {
        errorMap: () => ({ message: 'Role must be ADMIN, MANAGER, or MEMBER' }),
      })
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

/**
 * Schema for user ID param.
 */
export const userIdParamSchema = z.object({
  id: z.string().uuid('Invalid user ID format'),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
