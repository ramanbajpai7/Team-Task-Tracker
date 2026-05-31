import { Request, Response, NextFunction } from 'express';
import { taskService } from './task.service';

export class TaskController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const task = await taskService.createTask(
        req.body,
        req.user!.userId,
        req.user!.organizationId
      );
      res.status(201).json({
        status: 201,
        message: 'Task created successfully',
        data: task,
      });
    } catch (error) {
      next(error);
    }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await taskService.listTasks(
        req.query as any,
        req.user!.userId,
        req.user!.role,
        req.user!.organizationId
      );
      res.status(200).json({
        status: 200,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const task = await taskService.getTaskById(
        req.params.id as string,
        req.user!.userId,
        req.user!.role,
        req.user!.organizationId
      );
      res.status(200).json({
        status: 200,
        data: task,
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const task = await taskService.updateTask(
        req.params.id as string,
        req.body,
        req.user!.organizationId
      );
      res.status(200).json({
        status: 200,
        message: 'Task updated successfully',
        data: task,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const task = await taskService.updateTaskStatus(
        req.params.id as string,
        req.body,
        req.user!.userId,
        req.user!.role,
        req.user!.organizationId
      );
      res.status(200).json({
        status: 200,
        message: 'Task status updated successfully',
        data: task,
      });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await taskService.deleteTask(req.params.id as string, req.user!.organizationId);
      res.status(200).json({
        status: 200,
        message: 'Task deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async analytics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await taskService.getAnalytics(req.user!.organizationId);
      res.status(200).json({
        status: 200,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const taskController = new TaskController();
