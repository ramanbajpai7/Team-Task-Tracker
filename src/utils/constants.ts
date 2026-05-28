import { TaskStatus } from '@prisma/client';

/**
 * Enforced status transitions (server-side, not free-form):
 * 
 *   TODO → IN_PROGRESS → IN_REVIEW → DONE
 *                  ↘ BLOCKED (reachable from any active state)
 *   BLOCKED → TODO | IN_PROGRESS | IN_REVIEW (return to any active state)
 *   DONE → (terminal, no further transitions)
 */
export const VALID_STATUS_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  [TaskStatus.TODO]: [TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED],
  [TaskStatus.IN_PROGRESS]: [TaskStatus.IN_REVIEW, TaskStatus.BLOCKED],
  [TaskStatus.IN_REVIEW]: [TaskStatus.DONE, TaskStatus.BLOCKED],
  [TaskStatus.DONE]: [], // Terminal state
  [TaskStatus.BLOCKED]: [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW],
};

/**
 * Check if a status transition is valid.
 */
export function isValidTransition(from: TaskStatus, to: TaskStatus): boolean {
  return VALID_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Default pagination values
 */
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

/**
 * Cache TTL in seconds
 */
export const CACHE_TTL = 300; // 5 minutes

/**
 * Cache key prefix
 */
export const CACHE_PREFIX = 'tasks' as const;
