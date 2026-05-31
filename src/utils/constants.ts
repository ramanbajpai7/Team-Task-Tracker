import { TaskStatus } from '@prisma/client';

// Enforced status transitions:
// TODO -> IN_PROGRESS -> IN_REVIEW -> DONE
// Any active state -> BLOCKED
// BLOCKED -> TODO | IN_PROGRESS | IN_REVIEW
// DONE is terminal
export const VALID_STATUS_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  [TaskStatus.TODO]: [TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED],
  [TaskStatus.IN_PROGRESS]: [TaskStatus.IN_REVIEW, TaskStatus.BLOCKED],
  [TaskStatus.IN_REVIEW]: [TaskStatus.DONE, TaskStatus.BLOCKED],
  [TaskStatus.DONE]: [],
  [TaskStatus.BLOCKED]: [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW],
};

export function isValidTransition(from: TaskStatus, to: TaskStatus): boolean {
  return VALID_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

export const CACHE_TTL = 300; // 5 minutes

export const CACHE_PREFIX = 'tasks' as const;
