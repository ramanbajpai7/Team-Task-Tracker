import { getRedisClient } from '../config/redis';
import { CACHE_TTL, CACHE_PREFIX } from './constants';

export function buildTaskListCacheKey(params: {
  organizationId: string;
  assigneeId?: string;
  page: number;
  limit: number;
  status?: string;
  priority?: string;
}): string {
  const parts = [
    CACHE_PREFIX,
    `org:${params.organizationId}`,
    `assignee:${params.assigneeId || 'all'}`,
    `page:${params.page}`,
    `limit:${params.limit}`,
    `status:${params.status || 'all'}`,
    `priority:${params.priority || 'all'}`,
  ];
  return parts.join(':');
}

export async function getCachedData<T>(key: string): Promise<T | null> {
  try {
    const redis = getRedisClient();
    const data = await redis.get(key);
    if (data) {
      return JSON.parse(data) as T;
    }
    return null;
  } catch (error) {
    console.error('Cache GET error:', error);
    return null;
  }
}

export async function setCachedData(key: string, data: unknown, ttl = CACHE_TTL): Promise<void> {
  try {
    const redis = getRedisClient();
    await redis.setex(key, ttl, JSON.stringify(data));
  } catch (error) {
    console.error('Cache SET error:', error);
  }
}

// Invalidate all cached task lists for an org using SCAN + DEL
export async function invalidateOrgTaskCache(organizationId: string): Promise<void> {
  try {
    const redis = getRedisClient();
    const pattern = `${CACHE_PREFIX}:org:${organizationId}:*`;

    let cursor = '0';
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;

      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== '0');
  } catch (error) {
    console.error('Cache INVALIDATION error:', error);
  }
}
