import app from './app';
import { config } from './config';
import prisma from './config/database';
import { connectRedis, disconnectRedis } from './config/redis';

async function main() {
  try {
    await prisma.$connect();
    console.log('PostgreSQL connected');

    await connectRedis();

    const server = app.listen(config.port, () => {
      console.log(`Server running on port ${config.port}`);
      console.log(`Swagger docs: http://localhost:${config.port}/api-docs`);
    });

    const shutdown = async (signal: string) => {
      console.log(`${signal} received, shutting down`);

      server.close(async () => {
        await prisma.$disconnect();
        console.log('PostgreSQL disconnected');

        await disconnectRedis();
        console.log('Redis disconnected');

        process.exit(0);
      });

      setTimeout(() => {
        console.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    console.error('Failed to start server:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
