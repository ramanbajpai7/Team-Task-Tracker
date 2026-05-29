import bcrypt from 'bcryptjs';
import prisma from '../../config/database';
import { CreateUserInput, UpdateUserInput } from './user.schemas';
import { ConflictError, NotFoundError, ValidationError } from '../../utils/errors';

const SALT_ROUNDS = 12;

/**
 * User management service.
 * All operations are scoped to the calling user's organization.
 */
export class UserService {
  /**
   * List all users in the organization.
   */
  async listUsers(organizationId: string) {
    const users = await prisma.user.findMany({
      where: { organizationId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        organizationId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return users;
  }

  /**
   * Get a single user by ID (must be in the same org).
   */
  async getUserById(userId: string, organizationId: string) {
    const user = await prisma.user.findFirst({
      where: { id: userId, organizationId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        organizationId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundError('User');
    }

    return user;
  }

  /**
   * Create a new user in the organization (ADMIN only).
   */
  async createUser(input: CreateUserInput, organizationId: string) {
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser) {
      throw new ConflictError('A user with this email already exists');
    }

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        name: input.name,
        role: input.role,
        organizationId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        organizationId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  }

  /**
   * Update a user (ADMIN only, same org).
   */
  async updateUser(userId: string, input: UpdateUserInput, organizationId: string) {
    const user = await prisma.user.findFirst({
      where: { id: userId, organizationId },
    });

    if (!user) {
      throw new NotFoundError('User');
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: input,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        organizationId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return updatedUser;
  }

  /**
   * Delete a user (ADMIN only, same org, cannot delete self).
   */
  async deleteUser(userId: string, organizationId: string, requestingUserId: string) {
    if (userId === requestingUserId) {
      throw new ValidationError('Cannot delete your own account');
    }

    const user = await prisma.user.findFirst({
      where: { id: userId, organizationId },
    });

    if (!user) {
      throw new NotFoundError('User');
    }

    await prisma.user.delete({
      where: { id: userId },
    });
  }
}

export const userService = new UserService();
