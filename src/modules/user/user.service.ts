import bcrypt from 'bcryptjs';
import prisma from '../../config/database';
import { CreateUserInput, UpdateUserInput } from './user.schemas';
import { ConflictError, NotFoundError, ValidationError } from '../../utils/errors';

const SALT_ROUNDS = 12;

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
} as const;

export class UserService {
  async listUsers(organizationId: string) {
    return prisma.user.findMany({
      where: { organizationId },
      select: USER_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getUserById(userId: string, organizationId: string) {
    const user = await prisma.user.findFirst({
      where: { id: userId, organizationId },
      select: USER_SELECT,
    });

    if (!user) {
      throw new NotFoundError('User');
    }

    return user;
  }

  async createUser(input: CreateUserInput, organizationId: string) {
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser) {
      throw new ConflictError('A user with this email already exists');
    }

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

    return prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        name: input.name,
        role: input.role,
        organizationId,
      },
      select: USER_SELECT,
    });
  }

  async updateUser(userId: string, input: UpdateUserInput, organizationId: string) {
    const user = await prisma.user.findFirst({
      where: { id: userId, organizationId },
    });

    if (!user) {
      throw new NotFoundError('User');
    }

    return prisma.user.update({
      where: { id: userId },
      data: input,
      select: USER_SELECT,
    });
  }

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
