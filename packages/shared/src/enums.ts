export enum SystemRole {
  ADMIN = 'ADMIN',
  MODERATOR = 'MODERATOR',
  USER = 'USER',
}

export enum WorkspaceRole {
  OWNER = 'OWNER',
  MANAGER = 'MANAGER',
  MEMBER = 'MEMBER',
}

export enum TaskStatus {
  BACKLOG = 'BACKLOG',
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  IN_REVIEW = 'IN_REVIEW',
  DONE = 'DONE',
  CANCELLED = 'CANCELLED',
}

export enum TaskPriority {
  LOWEST = 'LOWEST',
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export const SYSTEM_ROLES = Object.values(SystemRole) as [SystemRole, ...SystemRole[]];
export const WORKSPACE_ROLES = Object.values(WorkspaceRole) as [
  WorkspaceRole,
  ...WorkspaceRole[],
];
export const TASK_STATUSES = Object.values(TaskStatus) as [TaskStatus, ...TaskStatus[]];
export const TASK_PRIORITIES = Object.values(TaskPriority) as [
  TaskPriority,
  ...TaskPriority[],
];

export const SYSTEM_ROLE_RANK: Record<SystemRole, number> = {
  [SystemRole.USER]: 0,
  [SystemRole.MODERATOR]: 1,
  [SystemRole.ADMIN]: 2,
};

export const WORKSPACE_ROLE_RANK: Record<WorkspaceRole, number> = {
  [WorkspaceRole.MEMBER]: 0,
  [WorkspaceRole.MANAGER]: 1,
  [WorkspaceRole.OWNER]: 2,
};

export function hasSystemRoleAtLeast(actual: SystemRole, required: SystemRole): boolean {
  return SYSTEM_ROLE_RANK[actual] >= SYSTEM_ROLE_RANK[required];
}

export function hasWorkspaceRoleAtLeast(
  actual: WorkspaceRole,
  required: WorkspaceRole,
): boolean {
  return WORKSPACE_ROLE_RANK[actual] >= WORKSPACE_ROLE_RANK[required];
}
