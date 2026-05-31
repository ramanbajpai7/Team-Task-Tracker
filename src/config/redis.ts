import Redis from 'ioredis';
import { config } from './index';

let redis: Redis | null = null;
let redisAvailable = false;

export function getRedisClient(): Redis | null {
  if (!redis && config.redis.url) {
    try {
      redis = new Redis(config.redis.url, {
        maxRetriesPerRequest: 3,
        retryStrategy(times: number) {
          if (times > 3) return null; // stop retrying after 3 attempts
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        lazyConnect: true,
        connectTimeout: 5000,
      });

      redis.on('error', (err) => {
        console.error('Redis connection error:', err.message);
        redisAvailable = false;
      });

      redis.on('connect', () => {
        console.log('✅ Redis connected');
        redisAvailable = true;
      });
    } catch {
      console.log('Redis not configured, running without cache');
      redis = null;
    }
  }

  return redis;
}

export function isRedisAvailable(): boolean {
  return redisAvailable;
}

export async function connectRedis(): Promise<void> {
  const client = getRedisClient();
  if (client) {
    try {
      await client.connect();
    } catch {
      console.log('Redis connection failed, running without cache');
      redisAvailable = false;
    }
  }
}

export async function disconnectRedis(): Promise<void> {
  if (redis) {
    try {
      await redis.quit();
    } catch {
      // ignore
    }
  }
}
