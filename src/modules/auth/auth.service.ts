import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../../config/database';
import { config } from '../../config';
import { RegisterInput, LoginInput } from './auth.schemas';
import {
  ConflictError,
  UnauthorizedError,
  NotFoundError,
} from '../../utils/errors';
import { JwtPayload } from '../../middleware/auth.middleware';

const SALT_ROUNDS = 12;

/**
 * Authentication service.
 * Handles user registration, login, token refresh, and logout.
 */
export class AuthService {
  /**
   * Register a new user.
   * The first user creates a new organization and becomes its ADMIN.
   */
  async register(input: RegisterInput) {
    // Check for existing user
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser) {
      throw new ConflictError('A user with this email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

    // Create organization and user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the organization
      const organization = await tx.organization.create({
        data: { name: input.organizationName },
      });

      // First user is ADMIN
      const user = await tx.user.create({
        data: {
          email: input.email,
          passwordHash,
          name: input.name,
          role: 'ADMIN',
          organizationId: organization.id,
        },
      });

      return { user, organization };
    });

    // Generate tokens
    const tokens = this.generateTokens({
      userId: result.user.id,
      email: result.user.email,
      role: result.user.role,
      organizationId: result.user.organizationId,
    });

    // Store refresh token hash
    const refreshTokenHash = await bcrypt.hash(tokens.refreshToken, SALT_ROUNDS);
    await prisma.user.update({
      where: { id: result.user.id },
      data: { refreshTokenHash },
    });

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
        organizationId: result.user.organizationId,
        organizationName: result.organization.name,
      },
      ...tokens,
    };
  }

  /**
   * Login with email and password.
   */
  async login(input: LoginInput) {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      include: { organization: true },
    });

    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Generate tokens
    const tokens = this.generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    });

    // Store refresh token hash
    const refreshTokenHash = await bcrypt.hash(tokens.refreshToken, SALT_ROUNDS);
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId,
        organizationName: user.organization.name,
      },
      ...tokens,
    };
  }

  /**
   * Refresh access token using a valid refresh token.
   * Implements token rotation — old refresh token is invalidated.
   */
  async refresh(refreshToken: string) {
    // Verify the refresh token
    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as JwtPayload;
    } catch {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    // Find user and verify stored refresh token hash
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { organization: true },
    });

    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const isRefreshTokenValid = await bcrypt.compare(refreshToken, user.refreshTokenHash);

    if (!isRefreshTokenValid) {
      // Possible token reuse attack — invalidate all sessions
      await prisma.user.update({
        where: { id: user.id },
        data: { refreshTokenHash: null },
      });
      throw new UnauthorizedError('Refresh token has been revoked. Please login again.');
    }

    // Generate new token pair (rotation)
    const tokens = this.generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    });

    // Store new refresh token hash
    const newRefreshTokenHash = await bcrypt.hash(tokens.refreshToken, SALT_ROUNDS);
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: newRefreshTokenHash },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId,
        organizationName: user.organization.name,
      },
      ...tokens,
    };
  }

  /**
   * Logout — invalidate the refresh token.
   */
  async logout(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundError('User');
    }

    await prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
  }

  /**
   * Generate access and refresh token pair.
   */
  private generateTokens(payload: JwtPayload) {
    const accessToken = jwt.sign(payload, config.jwt.accessSecret, {
      expiresIn: config.jwt.accessExpiry,
    } as jwt.SignOptions);

    const refreshToken = jwt.sign(payload, config.jwt.refreshSecret, {
      expiresIn: config.jwt.refreshExpiry,
    } as jwt.SignOptions);

    return { accessToken, refreshToken };
  }
}

export const authService = new AuthService();
