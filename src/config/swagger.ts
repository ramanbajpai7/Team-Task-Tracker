import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Team Task Tracker API',
      version: '1.0.0',
      description:
        'A REST API for team-based task tracking with authentication, role-based access control, Redis caching, and containerized deployment.',
      contact: {
        name: 'API Support',
      },
    },
    servers: [
      {
        url: '/api',
        description: 'API server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT access token',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            status: { type: 'integer', example: 400 },
            code: { type: 'string', example: 'VALIDATION_ERROR' },
            message: { type: 'string', example: 'title is required' },
          },
        },
        Organization: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            name: { type: 'string' },
            role: { type: 'string', enum: ['ADMIN', 'MANAGER', 'MEMBER'] },
            organizationId: { type: 'string', format: 'uuid' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Task: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            description: { type: 'string', nullable: true },
            priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
            status: {
              type: 'string',
              enum: ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED'],
            },
            assigneeId: { type: 'string', format: 'uuid', nullable: true },
            createdById: { type: 'string', format: 'uuid' },
            organizationId: { type: 'string', format: 'uuid' },
            dueDate: { type: 'string', format: 'date-time', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  },
  apis: ['./src/modules/**/*.routes.ts', './dist/modules/**/*.routes.js'],
};

export const swaggerSpec = swaggerJsdoc(options);
