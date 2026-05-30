import request from 'supertest';
import app from '../src/app';
import prisma from '../src/config/database';

/**
 * Task module integration tests.
 * Tests CRUD, status transitions, RBAC, pagination, and filtering.
 * 
 * Note: These tests require a running PostgreSQL instance.
 */

let adminToken: string;
let managerToken: string;
let memberToken: string;
let orgId: string;
let memberId: string;
let taskId: string;

const timestamp = Date.now();

beforeAll(async () => {
  await prisma.$connect();

  // Register admin (creates org)
  const adminRes = await request(app).post('/api/auth/register').send({
    email: `tasktest-admin-${timestamp}@example.com`,
    password: 'TestPass1',
    name: 'Task Admin',
    organizationName: `TaskTestOrg-${timestamp}`,
  });
  adminToken = adminRes.body.data.accessToken;
  orgId = adminRes.body.data.user.organizationId;

  // Create manager via admin
  const managerRes = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      email: `tasktest-manager-${timestamp}@example.com`,
      password: 'TestPass1',
      name: 'Task Manager',
      role: 'MANAGER',
    });
  
  // Login as manager to get token
  const managerLoginRes = await request(app).post('/api/auth/login').send({
    email: `tasktest-manager-${timestamp}@example.com`,
    password: 'TestPass1',
  });
  managerToken = managerLoginRes.body.data.accessToken;

  // Create member via admin
  const memberRes = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      email: `tasktest-member-${timestamp}@example.com`,
      password: 'TestPass1',
      name: 'Task Member',
      role: 'MEMBER',
    });
  memberId = memberRes.body.data.id;

  // Login as member
  const memberLoginRes = await request(app).post('/api/auth/login').send({
    email: `tasktest-member-${timestamp}@example.com`,
    password: 'TestPass1',
  });
  memberToken = memberLoginRes.body.data.accessToken;
});

afterAll(async () => {
  // Cleanup
  try {
    await prisma.task.deleteMany({ where: { organizationId: orgId } });
    await prisma.user.deleteMany({ where: { organizationId: orgId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
  } catch {
    // Ignore cleanup errors
  }
  await prisma.$disconnect();
});

describe('POST /api/tasks (Create)', () => {
  it('should create a task as ADMIN', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Admin task',
        description: 'Created by admin',
        priority: 'HIGH',
        assigneeId: memberId,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });

    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe('Admin task');
    expect(res.body.data.priority).toBe('HIGH');
    expect(res.body.data.status).toBe('TODO');
    taskId = res.body.data.id;
  });

  it('should create a task as MANAGER', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        title: 'Manager task',
        priority: 'LOW',
      });

    expect(res.status).toBe(201);
  });

  it('should reject task creation by MEMBER', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        title: 'Member task attempt',
      });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('should reject task without title', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        description: 'No title',
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/tasks (List)', () => {
  it('should list tasks with pagination', async () => {
    const res = await request(app)
      .get('/api/tasks?page=1&limit=10')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('tasks');
    expect(res.body.data).toHaveProperty('pagination');
    expect(res.body.data.pagination).toHaveProperty('page', 1);
    expect(res.body.data.pagination).toHaveProperty('limit', 10);
    expect(res.body.data.pagination).toHaveProperty('total');
  });

  it('should filter tasks by status', async () => {
    const res = await request(app)
      .get('/api/tasks?status=TODO')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    res.body.data.tasks.forEach((task: any) => {
      expect(task.status).toBe('TODO');
    });
  });

  it('should filter tasks by priority', async () => {
    const res = await request(app)
      .get('/api/tasks?priority=HIGH')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    res.body.data.tasks.forEach((task: any) => {
      expect(task.priority).toBe('HIGH');
    });
  });

  it('MEMBER should only see assigned tasks', async () => {
    const res = await request(app)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${memberToken}`);

    expect(res.status).toBe(200);
    res.body.data.tasks.forEach((task: any) => {
      expect(task.assigneeId).toBe(memberId);
    });
  });
});

describe('GET /api/tasks/:id (Get by ID)', () => {
  it('should get a task by ID', async () => {
    const res = await request(app)
      .get(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(taskId);
  });

  it('should return 404 for non-existent task', async () => {
    const res = await request(app)
      .get('/api/tasks/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/tasks/:id (Update)', () => {
  it('should update task fields', async () => {
    const res = await request(app)
      .patch(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Updated admin task',
        priority: 'MEDIUM',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Updated admin task');
    expect(res.body.data.priority).toBe('MEDIUM');
  });

  it('MEMBER should not be able to update tasks', async () => {
    const res = await request(app)
      .patch(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ title: 'Hacked title' });

    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/tasks/:id/status (Status transitions)', () => {
  it('should transition TODO → IN_PROGRESS', async () => {
    const res = await request(app)
      .patch(`/api/tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'IN_PROGRESS' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('IN_PROGRESS');
  });

  it('should transition IN_PROGRESS → IN_REVIEW', async () => {
    const res = await request(app)
      .patch(`/api/tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'IN_REVIEW' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('IN_REVIEW');
  });

  it('should transition IN_REVIEW → DONE', async () => {
    const res = await request(app)
      .patch(`/api/tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'DONE' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('DONE');
  });

  it('should reject invalid transition DONE → IN_PROGRESS', async () => {
    const res = await request(app)
      .patch(`/api/tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'IN_PROGRESS' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('should allow transition to BLOCKED from active state', async () => {
    // Create a new task for this test
    const createRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Block test task' });

    const newTaskId = createRes.body.data.id;

    // TODO → IN_PROGRESS first
    await request(app)
      .patch(`/api/tasks/${newTaskId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'IN_PROGRESS' });

    // IN_PROGRESS → BLOCKED
    const res = await request(app)
      .patch(`/api/tasks/${newTaskId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'BLOCKED' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('BLOCKED');
  });

  it('MEMBER assignee can change status of their task', async () => {
    // Create a task assigned to member
    const createRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Member status test', assigneeId: memberId });

    const memberTaskId = createRes.body.data.id;

    const res = await request(app)
      .patch(`/api/tasks/${memberTaskId}/status`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ status: 'IN_PROGRESS' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('IN_PROGRESS');
  });
});

describe('DELETE /api/tasks/:id', () => {
  it('MEMBER should not be able to delete tasks', async () => {
    const res = await request(app)
      .delete(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${memberToken}`);

    expect(res.status).toBe(403);
  });

  it('should delete a task as ADMIN', async () => {
    const res = await request(app)
      .delete(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
  });

  it('should return 404 for deleted task', async () => {
    const res = await request(app)
      .get(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });
});

describe('GET /api/analytics/tasks', () => {
  it('should return analytics for ADMIN', async () => {
    const res = await request(app)
      .get('/api/analytics/tasks')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('overdueTasksPerUser');
    expect(res.body.data).toHaveProperty('avgCompletionTimeHours');
    expect(res.body.data).toHaveProperty('totalCompletedTasks');
  });

  it('MEMBER should not access analytics', async () => {
    const res = await request(app)
      .get('/api/analytics/tasks')
      .set('Authorization', `Bearer ${memberToken}`);

    expect(res.status).toBe(403);
  });
});
