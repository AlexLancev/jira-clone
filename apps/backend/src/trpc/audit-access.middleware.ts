import { TRPCError } from '@trpc/server';
import { SystemRole, WorkspaceRole, hasSystemRoleAtLeast, hasWorkspaceRoleAtLeast } from '@repo/shared';
import type { ContextUser } from './context';
import { t } from './init';

export function extractWorkspaceId(input: unknown): string | undefined {
  if (typeof input !== 'object' || input === null) {
    return undefined;
  }

  const candidate = (input as { workspaceId?: unknown }).workspaceId;
  if (typeof candidate !== 'string') {
    return undefined;
  }

  const trimmed = candidate.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function canReadAuditLogs(
  user: ContextUser,
  workspaceRole: WorkspaceRole | null,
): boolean {
  if (hasSystemRoleAtLeast(user.systemRole, SystemRole.MODERATOR)) {
    return true;
  }

  if (!workspaceRole) {
    return false;
  }

  return hasWorkspaceRoleAtLeast(workspaceRole, WorkspaceRole.MANAGER);
}

export const auditAccessMiddleware = t.middleware(async ({ ctx, input, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
    });
  }

  const workspaceId = extractWorkspaceId(input);
  if (!workspaceId) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'workspaceId is required',
    });
  }

  const workspace = await ctx.prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      members: {
        where: { userId: ctx.user.id },
      },
    },
  });

  if (!workspace) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Workspace not found',
    });
  }

  const membership = workspace.members[0] ?? null;
  const workspaceRole = (membership?.workspaceRole as WorkspaceRole | undefined) ?? null;

  if (!canReadAuditLogs(ctx.user, workspaceRole)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Audit logs are restricted to workspace owners, managers, and system operators',
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      workspace,
      workspaceMembership: membership,
    },
  });
});
