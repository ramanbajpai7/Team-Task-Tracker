import { z } from 'zod';

/**
 * Schema for creating a task.
 */
export const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title must be 255 characters or fewer'),
  description: z.string().max(5000, 'Description must be 5000 characters or fewer').optional(),
  priority: z
    .enum(['LOW', 'MEDIUM', 'HIGH'], {
      errorMap: () => ({ message: 'Priority must be LOW, MEDIUM, or HIGH' }),
    })
    .optional()
    .default('MEDIUM'),
  assigneeId: z.string().uuid('Invalid assignee ID format').optional(),
  dueDate: z
    .string()
    .datetime({ message: 'Invalid date format. Use ISO 8601 (e.g., 2024-12-31T23:59:59Z)' })
    .optional()
    .refine(
      (val) => {
        if (!val) return true;
        return new Date(val) > new Date();
      },
      { message: 'due_date must be a future date' }
    ),
});

/**
 * Schema for updating a task.
 */
export const updateTaskSchema = z
  .object({
    title: z.string().min(1).max(255).optional(),
    description: z.string().max(5000).optional().nullable(),
    priority: z
      .enum(['LOW', 'MEDIUM', 'HIGH'], {
        errorMap: () => ({ message: 'Priority must be LOW, MEDIUM, or HIGH' }),
      })
      .optional(),
    assigneeId: z.string().uuid('Invalid assignee ID format').optional().nullable(),
    dueDate: z
      .string()
      .datetime({ message: 'Invalid date format' })
      .optional()
      .nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

/**
 * Schema for updating task status.
 */
export const updateTaskStatusSchema = z.object({
  status: z.enum(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED'], {
    errorMap: () => ({
      message: 'Status must be TODO, IN_PROGRESS, IN_REVIEW, DONE, or BLOCKED',
    }),
  }),
});

/**
 * Schema for task list query parameters.
 */
export const listTasksQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .pipe(z.number().int().positive('Page must be a positive integer')),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .pipe(z.number().int().min(1).max(100, 'Limit must be 100 or fewer')),
  status: z
    .enum(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED'])
    .optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  assignee: z.string().uuid('Invalid assignee ID format').optional(),
});

/**
 * Schema for task ID param.
 */
export const taskIdParamSchema = z.object({
  id: z.string().uuid('Invalid task ID format'),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>;
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
