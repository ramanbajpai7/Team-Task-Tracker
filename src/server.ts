import app from './app';
import { config } from './config';
import prisma from './config/database';
import { connectRedis, disconnectRedis } from './config/redis';

async function main() {
  try {
    // Connect to PostgreSQL via Prisma
    await prisma.$connect();
    console.log('✅ PostgreSQL connected');

    // Connect to Redis
    await connectRedis();

    // Start HTTP server
    const server = app.listen(config.port, () => {
      console.log(`\n🚀 Team Task Tracker API is running on port ${config.port}`);
      console.log(`📚 Swagger docs: http://localhost:${config.port}/api-docs`);
      console.log(`❤️  Health check: http://localhost:${config.port}/api/health\n`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n${signal} received. Shutting down gracefully...`);
      
      server.close(async () => {
        await prisma.$disconnect();
        console.log('✅ PostgreSQL disconnected');

        await disconnectRedis();
        console.log('✅ Redis disconnected');

        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        console.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
