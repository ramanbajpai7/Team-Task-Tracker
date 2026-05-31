/**
 * Vercel Serverless Function entry point.
 * Wraps the Express app for serverless deployment.
 */
import app from '../src/app';
import prisma from '../src/config/database';
import { connectRedis } from '../src/config/redis';

// Initialize connections on cold start
let isConnected = false;

async function ensureConnections() {
  if (!isConnected) {
    try {
      await prisma.$connect();
      console.log('PostgreSQL connected');
    } catch (err) {
      console.error('PostgreSQL connection error:', err);
    }
    try {
      await connectRedis();
    } catch (err) {
      console.log('Redis not available, running without cache');
    }
    isConnected = true;
  }
}

export default async function handler(req: any, res: any) {
  await ensureConnections();
  return app(req, res);
}
