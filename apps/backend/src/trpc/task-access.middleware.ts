import { TRPCError } from '@trpc/server';
import { SystemRole, WorkspaceRole, hasSystemRoleAtLeast, hasWorkspaceRoleAtLeast } from '@repo/shared';
import type { Prisma } from '@prisma/client';
import type { ContextUser } from './context';
import { t } from './init';

export type TaskWithAccess = Prisma.TaskGetPayload<{
  include: {
    workspace: {
      include: {
        members: true;
      };
    };
  };
}>;

export interface TaskAccessContext {
  user: ContextUser;
  task: TaskWithAccess;
  workspaceMembership: TaskWithAccess['workspace']['members'][number] | null;
}

export function extractTaskId(input: unknown): string | undefined {
  if (typeof input === 'string') {
    const trimmed = input.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (typeof input !== 'object' || input === null) {
    return undefined;
  }

  const record = input as Record<string, unknown>;
  const candidate = record.taskId ?? record.id;

  if (typeof candidate !== 'string') {
    return undefined;
  }

  const trimmed = candidate.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function canAccessTask(user: ContextUser, task: TaskWithAccess): boolean {
  if (hasSystemRoleAtLeast(user.systemRole, SystemRole.MODERATOR)) {
    return true;
  }

  const membership = task.workspace.members[0] ?? null;
  if (
    membership &&
    hasWorkspaceRoleAtLeast(membership.workspaceRole as WorkspaceRole, WorkspaceRole.MANAGER)
  ) {
    return true;
  }

  if (task.creatorId === user.id || task.assigneeId === user.id) {
    return true;
  }

  return false;
}

export const taskAccessMiddleware = t.middleware(async ({ ctx, getRawInput, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
    });
  }

  const rawInput = await getRawInput();
  const taskId = extractTaskId(rawInput);
  if (!taskId) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'taskId is required',
    });
  }

  const task = await ctx.prisma.task.findFirst({
    where: {
      id: taskId,
      deletedAt: null,
    },
    include: {
      workspace: {
        include: {
          members: {
            where: { userId: ctx.user.id },
          },
        },
      },
    },
  });

  if (!task) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Task not found',
    });
  }

  if (!canAccessTask(ctx.user, task)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Insufficient permissions to access this task',
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      task,
      workspaceMembership: task.workspace.members[0] ?? null,
    },
  });
});
