import { TaskStatus } from './enums';

export class InvalidTaskStatusTransitionError extends Error {
  readonly from: TaskStatus;
  readonly to: TaskStatus;

  constructor(from: TaskStatus, to: TaskStatus) {
    super(`Transition from "${from}" to "${to}" is not allowed`);
    this.name = 'InvalidTaskStatusTransitionError';
    this.from = from;
    this.to = to;
  }
}

/**
 * Directed graph of legal TaskStatus transitions.
 * Keys are current statuses; values are the statuses that may be entered next.
 */
export const TASK_STATUS_TRANSITIONS: Readonly<Record<TaskStatus, readonly TaskStatus[]>> =
  Object.freeze({
    [TaskStatus.BACKLOG]: Object.freeze([TaskStatus.TODO, TaskStatus.CANCELLED]),
    [TaskStatus.TODO]: Object.freeze([
      TaskStatus.BACKLOG,
      TaskStatus.IN_PROGRESS,
      TaskStatus.CANCELLED,
    ]),
    [TaskStatus.IN_PROGRESS]: Object.freeze([
      TaskStatus.TODO,
      TaskStatus.IN_REVIEW,
      TaskStatus.CANCELLED,
    ]),
    [TaskStatus.IN_REVIEW]: Object.freeze([
      TaskStatus.IN_PROGRESS,
      TaskStatus.DONE,
      TaskStatus.TODO,
    ]),
    [TaskStatus.DONE]: Object.freeze([TaskStatus.TODO, TaskStatus.IN_REVIEW]),
    [TaskStatus.CANCELLED]: Object.freeze([TaskStatus.BACKLOG, TaskStatus.TODO]),
  });

export function getAllowedTransitions(from: TaskStatus): readonly TaskStatus[] {
  return TASK_STATUS_TRANSITIONS[from];
}

export function canTransitionTaskStatus(from: TaskStatus, to: TaskStatus): boolean {
  if (from === to) {
    return true;
  }

  return TASK_STATUS_TRANSITIONS[from].includes(to);
}

export function assertTaskStatusTransition(from: TaskStatus, to: TaskStatus): void {
  if (!canTransitionTaskStatus(from, to)) {
    throw new InvalidTaskStatusTransitionError(from, to);
  }
}
