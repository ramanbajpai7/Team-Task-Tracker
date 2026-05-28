import { PrismaClient, Role, Priority, TaskStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clean existing data
  await prisma.task.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  // Create organization
  const org = await prisma.organization.create({
    data: { name: 'Acme Corp' },
  });
  console.log(`  ✅ Organization: ${org.name}`);

  // Create users
  const passwordHash = await bcrypt.hash('Password1', 12);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@acme.com',
      passwordHash,
      name: 'Alice Admin',
      role: Role.ADMIN,
      organizationId: org.id,
    },
  });

  const manager = await prisma.user.create({
    data: {
      email: 'manager@acme.com',
      passwordHash,
      name: 'Bob Manager',
      role: Role.MANAGER,
      organizationId: org.id,
    },
  });

  const member1 = await prisma.user.create({
    data: {
      email: 'member1@acme.com',
      passwordHash,
      name: 'Charlie Member',
      role: Role.MEMBER,
      organizationId: org.id,
    },
  });

  const member2 = await prisma.user.create({
    data: {
      email: 'member2@acme.com',
      passwordHash,
      name: 'Diana Member',
      role: Role.MEMBER,
      organizationId: org.id,
    },
  });

  console.log('  ✅ Users: admin@acme.com, manager@acme.com, member1@acme.com, member2@acme.com');
  console.log('  🔑 All passwords: Password1');

  // Create sample tasks
  const tasks = await Promise.all([
    prisma.task.create({
      data: {
        title: 'Set up CI/CD pipeline',
        description: 'Configure GitHub Actions for automated testing and deployment',
        priority: Priority.HIGH,
        status: TaskStatus.IN_PROGRESS,
        assigneeId: member1.id,
        createdById: manager.id,
        organizationId: org.id,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      },
    }),
    prisma.task.create({
      data: {
        title: 'Write API documentation',
        description: 'Document all endpoints using Swagger/OpenAPI',
        priority: Priority.MEDIUM,
        status: TaskStatus.TODO,
        assigneeId: member2.id,
        createdById: manager.id,
        organizationId: org.id,
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
      },
    }),
    prisma.task.create({
      data: {
        title: 'Fix login bug',
        description: 'Users are getting logged out after 5 minutes',
        priority: Priority.HIGH,
        status: TaskStatus.TODO,
        assigneeId: member1.id,
        createdById: admin.id,
        organizationId: org.id,
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
      },
    }),
    prisma.task.create({
      data: {
        title: 'Design new dashboard',
        description: 'Create mockups for the analytics dashboard',
        priority: Priority.LOW,
        status: TaskStatus.IN_REVIEW,
        assigneeId: member2.id,
        createdById: manager.id,
        organizationId: org.id,
        dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), // 21 days from now
      },
    }),
    prisma.task.create({
      data: {
        title: 'Upgrade Node.js version',
        description: 'Upgrade from Node 18 to Node 20 LTS',
        priority: Priority.MEDIUM,
        status: TaskStatus.BLOCKED,
        assigneeId: member1.id,
        createdById: admin.id,
        organizationId: org.id,
        dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // Overdue: 1 day ago
      },
    }),
    prisma.task.create({
      data: {
        title: 'Refactor auth module',
        description: 'Separate auth logic into its own service',
        priority: Priority.MEDIUM,
        status: TaskStatus.DONE,
        assigneeId: member2.id,
        createdById: manager.id,
        organizationId: org.id,
        dueDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      },
    }),
  ]);

  console.log(`  ✅ Tasks: ${tasks.length} sample tasks created`);
  console.log('\n✅ Seeding complete!\n');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
