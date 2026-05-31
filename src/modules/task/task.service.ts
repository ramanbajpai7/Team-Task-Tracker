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

const TASK_INCLUDE = {
  assignee: {
    select: { id: true, name: true, email: true },
  },
  createdBy: {
    select: { id: true, name: true, email: true },
  },
} as const;

export class TaskService {
  async createTask(
    input: CreateTaskInput,
    createdById: string,
    organizationId: string
  ) {
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
      include: TASK_INCLUDE,
    });

    await invalidateOrgTaskCache(organizationId);

    return task;
  }

  async listTasks(
    query: ListTasksQuery,
    userId: string,
    userRole: string,
    organizationId: string
  ) {
    const { page, limit, status, priority, assignee } = query;

    // MEMBER can only see their own tasks
    const effectiveAssignee = userRole === Role.MEMBER ? userId : assignee;

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

    const [total, tasks] = await Promise.all([
      prisma.task.count({ where }),
      prisma.task.findMany({
        where,
        include: TASK_INCLUDE,
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

    await setCachedData(cacheKey, result);

    return result;
  }

  async getTaskById(taskId: string, userId: string, userRole: string, organizationId: string) {
    const task = await prisma.task.findFirst({
      where: { id: taskId, organizationId },
      include: TASK_INCLUDE,
    });

    if (!task) {
      throw new NotFoundError('Task');
    }

    if (userRole === Role.MEMBER && task.assigneeId !== userId) {
      throw new ForbiddenError('You can only view tasks assigned to you');
    }

    return task;
  }

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
      include: TASK_INCLUDE,
    });

    await invalidateOrgTaskCache(organizationId);

    return updatedTask;
  }

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

    const isAssignee = task.assigneeId === userId;
    const isManagerOrAdmin = userRole === Role.ADMIN || userRole === Role.MANAGER;

    if (!isAssignee && !isManagerOrAdmin) {
      throw new ForbiddenError('Only the assignee or a MANAGER/ADMIN can change task status');
    }

    const newStatus = input.status as TaskStatus;
    if (!isValidTransition(task.status, newStatus)) {
      throw new InvalidTransitionError(task.status, newStatus);
    }

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: { status: newStatus },
      include: TASK_INCLUDE,
    });

    await invalidateOrgTaskCache(organizationId);

    return updatedTask;
  }

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

    await invalidateOrgTaskCache(organizationId);
  }

  async getAnalytics(organizationId: string) {
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
