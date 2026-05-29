import { Prisma, TaskStatus, Role } from '@prisma/client';
import prisma from '../../config/database';
import {
  CreateTaskInput,
  UpdateTaskInput,
  UpdateTaskStatusInput,
  ListTasksQuery,
} from './task.schemas';
import {
  NotFoundError,
  ValidationError,
  ForbiddenError,
  InvalidTransitionError,
} from '../../utils/errors';
import { isValidTransition } from '../../utils/constants';
import {
  buildTaskListCacheKey,
  getCachedData,
  setCachedData,
  invalidateOrgTaskCache,
} from '../../utils/cache';

/**
 * Task management service.
 * Handles CRUD, status transitions, pagination, filtering, and Redis caching.
 */
export class TaskService {
  /**
   * Create a new task.
   * Only ADMIN and MANAGER can create tasks.
   */
  async createTask(
    input: CreateTaskInput,
    createdById: string,
    organizationId: string
  ) {
    // If assignee is specified, verify they belong to the same org
    if (input.assigneeId) {
      const assignee = await prisma.user.findFirst({
        where: { id: input.assigneeId, organizationId },
      });
      if (!assignee) {
        throw new ValidationError('Assignee must be a user in the organization');
      }
    }

    const task = await prisma.task.create({
      data: {
        title: input.title,
        description: input.description,
        priority: input.priority,
        assigneeId: input.assigneeId,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        createdById,
        organizationId,
      },
      include: {
        assignee: {
          select: { id: true, name: true, email: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Invalidate cached task lists for this org
    await invalidateOrgTaskCache(organizationId);

    return task;
  }

  /**
   * List tasks with pagination and filtering.
   * MEMBER can only see tasks assigned to them.
   * Results are cached in Redis.
   */
  async listTasks(
    query: ListTasksQuery,
    userId: string,
    userRole: string,
    organizationId: string
  ) {
    const { page, limit, status, priority, assignee } = query;

    // MEMBER restriction: can only see their own tasks
    const effectiveAssignee = userRole === Role.MEMBER ? userId : assignee;

    // Try cache first
    const cacheKey = buildTaskListCacheKey({
      organizationId,
      assigneeId: effectiveAssignee,
      page,
      limit,
      status,
      priority,
    });

    const cached = await getCachedData<{ tasks: unknown[]; pagination: unknown }>(cacheKey);
    if (cached) {
      return cached;
    }

    // Build where clause
    const where: Prisma.TaskWhereInput = {
      organizationId,
    };

    if (effectiveAssignee) {
      where.assigneeId = effectiveAssignee;
    }

    if (status) {
      where.status = status as TaskStatus;
    }

    if (priority) {
      where.priority = priority as Prisma.EnumPriorityFilter;
    }

    // Execute count and find in parallel
    const [total, tasks] = await Promise.all([
      prisma.task.count({ where }),
      prisma.task.findMany({
        where,
        include: {
          assignee: {
            select: { id: true, name: true, email: true },
          },
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const result = {
      tasks,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };

    // Cache the result
    await setCachedData(cacheKey, result);

    return result;
  }

  /**
   * Get a single task by ID.
   * MEMBER can only see tasks assigned to them.
   */
  async getTaskById(taskId: string, userId: string, userRole: string, organizationId: string) {
    const task = await prisma.task.findFirst({
      where: { id: taskId, organizationId },
      include: {
        assignee: {
          select: { id: true, name: true, email: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!task) {
      throw new NotFoundError('Task');
    }

    // MEMBER can only view tasks assigned to them
    if (userRole === Role.MEMBER && task.assigneeId !== userId) {
      throw new ForbiddenError('You can only view tasks assigned to you');
    }

    return task;
  }

  /**
   * Update a task's fields (not status).
   * ADMIN and MANAGER only.
   */
  async updateTask(
    taskId: string,
    input: UpdateTaskInput,
    organizationId: string
  ) {
    const task = await prisma.task.findFirst({
      where: { id: taskId, organizationId },
    });

    if (!task) {
      throw new NotFoundError('Task');
    }

    // If assignee is being changed, verify new assignee is in the org
    if (input.assigneeId) {
      const assignee = await prisma.user.findFirst({
        where: { id: input.assigneeId, organizationId },
      });
      if (!assignee) {
        throw new ValidationError('Assignee must be a user in the organization');
      }
    }

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        ...(input.title && { title: input.title }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.priority && { priority: input.priority }),
        ...(input.assigneeId !== undefined && { assigneeId: input.assigneeId }),
        ...(input.dueDate !== undefined && {
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
        }),
      },
      include: {
        assignee: {
          select: { id: true, name: true, email: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Invalidate cache
    await invalidateOrgTaskCache(organizationId);

    return updatedTask;
  }

  /**
   * Update task status with enforced transitions.
   * Only the assignee or a MANAGER/ADMIN can advance a task's status.
   */
  async updateTaskStatus(
    taskId: string,
    input: UpdateTaskStatusInput,
    userId: string,
    userRole: string,
    organizationId: string
  ) {
    const task = await prisma.task.findFirst({
      where: { id: taskId, organizationId },
    });

    if (!task) {
      throw new NotFoundError('Task');
    }

    // Permission check: only assignee or MANAGER/ADMIN can change status
    const isAssignee = task.assigneeId === userId;
    const isManagerOrAdmin = userRole === Role.ADMIN || userRole === Role.MANAGER;

    if (!isAssignee && !isManagerOrAdmin) {
      throw new ForbiddenError('Only the assignee or a MANAGER/ADMIN can change task status');
    }

    // Validate status transition
    const newStatus = input.status as TaskStatus;
    if (!isValidTransition(task.status, newStatus)) {
      throw new InvalidTransitionError(task.status, newStatus);
    }

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: { status: newStatus },
      include: {
        assignee: {
          select: { id: true, name: true, email: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Invalidate cache
    await invalidateOrgTaskCache(organizationId);

    return updatedTask;
  }

  /**
   * Delete a task.
   * ADMIN and MANAGER only.
   */
  async deleteTask(taskId: string, organizationId: string) {
    const task = await prisma.task.findFirst({
      where: { id: taskId, organizationId },
    });

    if (!task) {
      throw new NotFoundError('Task');
    }

    await prisma.task.delete({
      where: { id: taskId },
    });

    // Invalidate cache
    await invalidateOrgTaskCache(organizationId);
  }

  /**
   * Get analytics: overdue task count per user + average completion time.
   */
  async getAnalytics(organizationId: string) {
    // Overdue tasks per user
    const overdueTasks = await prisma.task.groupBy({
      by: ['assigneeId'],
      where: {
        organizationId,
        dueDate: { lt: new Date() },
        status: { notIn: ['DONE'] },
        assigneeId: { not: null },
      },
      _count: { id: true },
    });

    // Enrich with user details
    const userIds = overdueTasks
      .map((t) => t.assigneeId)
      .filter((id): id is string => id !== null);

    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    const overdueTasksPerUser = overdueTasks.map((t) => ({
      userId: t.assigneeId,
      name: userMap.get(t.assigneeId!)?.name || 'Unknown',
      email: userMap.get(t.assigneeId!)?.email || 'Unknown',
      overdueCount: t._count.id,
    }));

    // Average completion time (for tasks that reached DONE)
    const completedTasks = await prisma.task.findMany({
      where: {
        organizationId,
        status: 'DONE',
      },
      select: {
        createdAt: true,
        updatedAt: true,
      },
    });

    let avgCompletionTimeHours = 0;
    if (completedTasks.length > 0) {
      const totalHours = completedTasks.reduce((sum, task) => {
        const diffMs = task.updatedAt.getTime() - task.createdAt.getTime();
        return sum + diffMs / (1000 * 60 * 60);
      }, 0);
      avgCompletionTimeHours = Math.round((totalHours / completedTasks.length) * 100) / 100;
    }

    return {
      overdueTasksPerUser,
      avgCompletionTimeHours,
      totalCompletedTasks: completedTasks.length,
    };
  }
}

export const taskService = new TaskService();
