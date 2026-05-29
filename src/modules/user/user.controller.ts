import { Request, Response, NextFunction } from 'express';
import { userService } from './user.service';

/**
 * User controller — thin layer that delegates to user service.
 */
export class UserController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const users = await userService.listUsers(req.user!.organizationId);
      res.status(200).json({
        status: 200,
        data: users,
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await userService.getUserById(req.params.id as string, req.user!.organizationId);
      res.status(200).json({
        status: 200,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await userService.createUser(req.body, req.user!.organizationId);
      res.status(201).json({
        status: 201,
        message: 'User created successfully',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await userService.updateUser(
        req.params.id as string,
        req.body,
        req.user!.organizationId
      );
      res.status(200).json({
        status: 200,
        message: 'User updated successfully',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await userService.deleteUser(req.params.id as string, req.user!.organizationId, req.user!.userId);
      res.status(200).json({
        status: 200,
        message: 'User deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const userController = new UserController();
