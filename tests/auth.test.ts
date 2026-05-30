import request from 'supertest';
import app from '../src/app';
import prisma from '../src/config/database';

/**
 * Auth module integration tests.
 * Tests registration, login, token refresh, and logout flows.
 * 
 * Note: These tests require a running PostgreSQL instance.
 * Run with: npm test
 */

const TEST_USER = {
  email: `test-${Date.now()}@example.com`,
  password: 'TestPass1',
  name: 'Test User',
  organizationName: 'Test Org',
};

let accessToken: string;
let refreshToken: string;

beforeAll(async () => {
  // Ensure clean state
  await prisma.$connect();
});

afterAll(async () => {
  // Cleanup test data
  try {
    const user = await prisma.user.findUnique({ where: { email: TEST_USER.email } });
    if (user) {
      await prisma.task.deleteMany({ where: { organizationId: user.organizationId } });
      await prisma.user.deleteMany({ where: { organizationId: user.organizationId } });
      await prisma.organization.deleteMany({ where: { id: user.organizationId } });
    }
  } catch {
    // Ignore cleanup errors
  }
  await prisma.$disconnect();
});

describe('POST /api/auth/register', () => {
  it('should register a new user and return tokens', async () => {
    const res = await request(app).post('/api/auth/register').send(TEST_USER);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe(201);
    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.body.data).toHaveProperty('refreshToken');
    expect(res.body.data.user.email).toBe(TEST_USER.email);
    expect(res.body.data.user.role).toBe('ADMIN');
    expect(res.body.data.user.organizationName).toBe(TEST_USER.organizationName);

    accessToken = res.body.data.accessToken;
    refreshToken = res.body.data.refreshToken;
  });

  it('should reject duplicate email', async () => {
    const res = await request(app).post('/api/auth/register').send(TEST_USER);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CONFLICT');
  });

  it('should reject weak password', async () => {
    const res = await request(app).post('/api/auth/register').send({
      ...TEST_USER,
      email: 'weak@example.com',
      password: 'weak',
    });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('should reject invalid email format', async () => {
    const res = await request(app).post('/api/auth/register').send({
      ...TEST_USER,
      email: 'not-an-email',
    });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/auth/login', () => {
  it('should login with correct credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: TEST_USER.email,
      password: TEST_USER.password,
    });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.body.data).toHaveProperty('refreshToken');
    expect(res.body.data.user.email).toBe(TEST_USER.email);

    accessToken = res.body.data.accessToken;
    refreshToken = res.body.data.refreshToken;
  });

  it('should reject incorrect password', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: TEST_USER.email,
      password: 'WrongPass1',
    });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('should reject non-existent email', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'nonexistent@example.com',
      password: 'SomePass1',
    });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });
});

describe('POST /api/auth/refresh', () => {
  it('should refresh tokens with valid refresh token', async () => {
    const res = await request(app).post('/api/auth/refresh').send({
      refreshToken,
    });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.body.data).toHaveProperty('refreshToken');
    expect(res.body.data.user.email).toBe(TEST_USER.email);

    // Store new tokens for subsequent tests
    accessToken = res.body.data.accessToken;
    refreshToken = res.body.data.refreshToken;

    // Verify new access token works for authenticated requests
    const authCheck = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(authCheck.status).toBe(200);
  });

  it('should reject invalid refresh token', async () => {
    const res = await request(app).post('/api/auth/refresh').send({
      refreshToken: 'completely-invalid-token',
    });

    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('should reject logout without auth token', async () => {
    const res = await request(app).post('/api/auth/logout');

    expect(res.status).toBe(401);
  });

  it('should logout successfully', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
  });
});

describe('Protected route access', () => {
  it('should reject access without token', async () => {
    const res = await request(app).get('/api/users');

    expect(res.status).toBe(401);
  });

  it('should reject access with invalid token', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', 'Bearer invalid-token');

    expect(res.status).toBe(401);
  });
});
