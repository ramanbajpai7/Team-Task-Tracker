import { Router } from 'express';
import { Role } from '@prisma/client';
import { taskController } from './task.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/rbac.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  createTaskSchema,
  updateTaskSchema,
  updateTaskStatusSchema,
  listTasksQuerySchema,
  taskIdParamSchema,
} from './task.schemas';

const router = Router();

/**
 * @swagger
 * /tasks:
 *   post:
 *     tags: [Tasks]
 *     summary: Create a new task
 *     description: Only ADMIN and MANAGER can create tasks.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title:
 *                 type: string
 *                 example: Implement login page
 *               description:
 *                 type: string
 *                 example: Build the login form with email/password fields
 *               priority:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH]
 *                 default: MEDIUM
 *               assigneeId:
 *                 type: string
 *                 format: uuid
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Task created successfully
 *       400:
 *         description: Validation error
 *       403:
 *         description: Insufficient permissions
 */
router.post(
  '/',
  authenticate,
  authorize(Role.ADMIN, Role.MANAGER),
  validate(createTaskSchema),
  taskController.create
);

/**
 * @swagger
 * /tasks:
 *   get:
 *     tags: [Tasks]
 *     summary: List tasks with pagination and filtering
 *     description: |
 *       All authenticated users can list tasks. MEMBER can only see tasks assigned to them.
 *       Supports pagination (page, limit) and filtering by status, priority, assignee.
 *       Results are cached in Redis per assignee.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [TODO, IN_PROGRESS, IN_REVIEW, DONE, BLOCKED]
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [LOW, MEDIUM, HIGH]
 *       - in: query
 *         name: assignee
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Paginated list of tasks
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/',
  authenticate,
  authorize(Role.ADMIN, Role.MANAGER, Role.MEMBER),
  validate(listTasksQuerySchema, 'query'),
  taskController.list
);

/**
 * @swagger
 * /tasks/{id}:
 *   get:
 *     tags: [Tasks]
 *     summary: Get a task by ID
 *     description: MEMBER can only view tasks assigned to them.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Task found
 *       404:
 *         description: Task not found
 */
router.get(
  '/:id',
  authenticate,
  authorize(Role.ADMIN, Role.MANAGER, Role.MEMBER),
  validate(taskIdParamSchema, 'params'),
  taskController.getById
);

/**
 * @swagger
 * /tasks/{id}:
 *   patch:
 *     tags: [Tasks]
 *     summary: Update task fields
 *     description: ADMIN and MANAGER only. Does not change status (use /tasks/{id}/status).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *                 nullable: true
 *               priority:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH]
 *               assigneeId:
 *                 type: string
 *                 format: uuid
 *                 nullable: true
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Task updated
 *       404:
 *         description: Task not found
 */
router.patch(
  '/:id',
  authenticate,
  authorize(Role.ADMIN, Role.MANAGER),
  validate(taskIdParamSchema, 'params'),
  validate(updateTaskSchema),
  taskController.update
);

/**
 * @swagger
 * /tasks/{id}/status:
 *   patch:
 *     tags: [Tasks]
 *     summary: Update task status
 *     description: |
 *       Enforced status transitions:
 *       - TODO → IN_PROGRESS → IN_REVIEW → DONE
 *       - Any active state → BLOCKED
 *       - BLOCKED → TODO | IN_PROGRESS | IN_REVIEW
 *       
 *       Only the assignee or a MANAGER/ADMIN can change status.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [TODO, IN_PROGRESS, IN_REVIEW, DONE, BLOCKED]
 *     responses:
 *       200:
 *         description: Status updated
 *       400:
 *         description: Invalid status transition
 */
router.patch(
  '/:id/status',
  authenticate,
  authorize(Role.ADMIN, Role.MANAGER, Role.MEMBER),
  validate(taskIdParamSchema, 'params'),
  validate(updateTaskStatusSchema),
  taskController.updateStatus
);

/**
 * @swagger
 * /tasks/{id}:
 *   delete:
 *     tags: [Tasks]
 *     summary: Delete a task
 *     description: ADMIN and MANAGER only.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Task deleted
 *       404:
 *         description: Task not found
 */
router.delete(
  '/:id',
  authenticate,
  authorize(Role.ADMIN, Role.MANAGER),
  validate(taskIdParamSchema, 'params'),
  taskController.delete
);

/**
 * @swagger
 * /analytics/tasks:
 *   get:
 *     tags: [Analytics]
 *     summary: Get task analytics
 *     description: |
 *       Returns overdue task count per user and average completion time.
 *       ADMIN and MANAGER only.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Analytics data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 overdueTasksPerUser:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       userId:
 *                         type: string
 *                       name:
 *                         type: string
 *                       overdueCount:
 *                         type: integer
 *                 avgCompletionTimeHours:
 *                   type: number
 *                 totalCompletedTasks:
 *                   type: integer
 */

export default router;
