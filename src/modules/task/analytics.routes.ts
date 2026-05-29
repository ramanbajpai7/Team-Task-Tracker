import { Router } from 'express';
import { Role } from '@prisma/client';
import { taskController } from './task.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/rbac.middleware';

const router = Router();

/**
 * Analytics routes — ADMIN and MANAGER only.
 */
router.get(
  '/tasks',
  authenticate,
  authorize(Role.ADMIN, Role.MANAGER),
  taskController.analytics
);

export default router;
