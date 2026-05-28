import { getRedisClient } from '../config/redis';
import { CACHE_TTL, CACHE_PREFIX } from './constants';

/**
 * Redis cache utility for task list caching.
 * 
 * Strategy: Cache-aside (lazy loading) with proactive invalidation.
 * 
 * - Cache key pattern: tasks:org:{orgId}:assignee:{assigneeId}:page:{page}:limit:{limit}:filters:{hash}
 * - On list queries: check Redis → if miss → query DB → cache result with TTL
 * - On any mutation: invalidate all cached task lists for the org
 * - TTL serves as a safety net for stale data
 */

/**
 * Generate a cache key for task list queries.
 */
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

/**
 * Get cached data from Redis.
 */
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
    return null; // Fail silently — cache miss is acceptable
  }
}

/**
 * Set data in Redis cache with TTL.
 */
export async function setCachedData(key: string, data: unknown, ttl = CACHE_TTL): Promise<void> {
  try {
    const redis = getRedisClient();
    await redis.setex(key, ttl, JSON.stringify(data));
  } catch (error) {
    console.error('Cache SET error:', error);
    // Fail silently — writing to cache is not critical
  }
}

/**
 * Invalidate all cached task lists for an organization.
 * Uses SCAN to find matching keys and delete them in batches.
 * 
 * This is called whenever a task is created, updated, or deleted within the org.
 */
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
    // Fail silently — stale cache will expire via TTL
  }
}
