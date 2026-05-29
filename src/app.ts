import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';

import { swaggerSpec } from './config/swagger';
import { errorHandler } from './middleware/error.middleware';

// Route imports
import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/user/user.routes';
import taskRoutes from './modules/task/task.routes';
import analyticsRoutes from './modules/task/analytics.routes';

const app = express();

// ─── Global Middleware ────────────────────────────────────────────────────────

// Security headers
app.use(helmet());

// CORS
app.use(cors());

// Request logging
app.use(morgan('dev'));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── API Documentation ───────────────────────────────────────────────────────

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Team Task Tracker API Docs',
}));

// Serve raw OpenAPI spec as JSON
app.get('/api-docs.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// ─── Health Check ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * /health:
 *   get:
 *     tags: [System]
 *     summary: Health check
 *     responses:
 *       200:
 *         description: API is running
 */
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 200,
    message: 'Team Task Tracker API is running',
    timestamp: new Date().toISOString(),
  });
});

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/analytics', analyticsRoutes);

// ─── 404 Handler ──────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({
    status: 404,
    code: 'NOT_FOUND',
    message: 'The requested endpoint does not exist',
  });
});

// ─── Global Error Handler (must be last) ──────────────────────────────────────

app.use(errorHandler);

export default app;
