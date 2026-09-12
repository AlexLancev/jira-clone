import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { observable } from '@trpc/server/observable';
import type { Notification, Task } from '@prisma/client';
import {
  SystemRole,
  WorkspaceRole,
  createTaskSchema,
  hasSystemRoleAtLeast,
  taskStatusSchema,
  updateTaskStatusSchema,
} from '@repo/shared';
import { writeAuditLog } from '../audit/audit-log';
import type { PrismaService } from '../prisma/prisma.service';
import { ee, NOTIFICATION_CREATED_EVENT, TASK_UPDATED_EVENT } from '../trpc/ee';
import { protectedProcedure, router, taskProcedure } from '../trpc/trpc';

const entityIdSchema = z.string().trim().cuid();

const listTasksSchema = z
  .object({
    workspaceId: entityIdSchema,
    projectId: entityIdSchema.nullable().optional(),
    status: taskStatusSchema.optional(),
  })
  .strict();

const createCommentSchema = z
  .object({
    taskId: entityIdSchema,
    body: z.string().trim().min(1).max(5000),
  })
  .strict();

async function assertCanCreateInWorkspace(
  prisma: PrismaService,
  params: {
    userId: string;
    systemRole: SystemRole;
    workspaceId: string;
    projectId?: string | null;
    parentTaskId?: string | null;
    assigneeId?: string | null;
  },
): Promise<void> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: params.workspaceId },
    include: {
      members: {
        where: { userId: params.userId },
      },
    },
  });

  if (!workspace) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Workspace not found' });
  }

  if (!hasSystemRoleAtLeast(params.systemRole, SystemRole.MODERATOR) && !workspace.members[0]) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You are not a member of this workspace',
    });
  }

  if (params.projectId) {
    const project = await prisma.project.findFirst({
      where: { id: params.projectId, workspaceId: params.workspaceId },
    });
    if (!project) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Project does not belong to this workspace',
      });
    }
  }

  if (params.parentTaskId) {
    const parent = await prisma.task.findFirst({
      where: { id: params.parentTaskId, workspaceId: params.workspaceId, deletedAt: null },
    });
    if (!parent) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Parent task was not found in this workspace',
      });
    }
  }

  if (params.assigneeId) {
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: params.workspaceId,
          userId: params.assigneeId,
        },
      },
    });
    if (!membership) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Assignee must be a member of the workspace',
      });
    }
  }
}

const STATUS_LABELS: Record<string, string> = {
  BACKLOG: 'Бэклог',
  TODO: 'К выполнению',
  IN_PROGRESS: 'В работе',
  IN_REVIEW: 'На проверке',
  DONE: 'Готово',
  CANCELLED: 'Отменено',
};

function describeActorRole(systemRole: SystemRole, workspaceRole: string | null): string {
  if (systemRole === SystemRole.ADMIN) {
    return 'Администратор';
  }
  if (systemRole === SystemRole.MODERATOR) {
    return 'Модератор';
  }
  if (workspaceRole === WorkspaceRole.OWNER) {
    return 'Владелец';
  }
  if (workspaceRole === WorkspaceRole.MANAGER) {
    return 'Менеджер';
  }
  return 'Пользователь';
}

function buildStatusChangeMessage(params: {
  actorName: string;
  actorSystemRole: SystemRole;
  actorWorkspaceRole: string | null;
  taskTitle: string;
  toStatus: string;
}): string {
  const role = describeActorRole(params.actorSystemRole, params.actorWorkspaceRole);
  const statusLabel = STATUS_LABELS[params.toStatus] ?? params.toStatus;
  return `${role} изменил статус вашей задачи «${params.taskTitle}» на ${statusLabel}`;
}

export const taskRouter = router({
  create: protectedProcedure.input(createTaskSchema).mutation(async ({ ctx, input }) => {
    await assertCanCreateInWorkspace(ctx.prisma, {
      userId: ctx.user.id,
      systemRole: ctx.user.systemRole,
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      parentTaskId: input.parentTaskId,
      assigneeId: input.assigneeId,
    });

    return ctx.prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          workspaceId: input.workspaceId,
          projectId: input.projectId ?? null,
          parentTaskId: input.parentTaskId ?? null,
          creatorId: ctx.user.id,
          assigneeId: input.assigneeId ?? null,
          title: input.title,
          description: input.description ?? null,
          status: input.status,
          priority: input.priority,
          dueDate: input.dueDate ?? null,
          estimatePoints: input.estimatePoints ?? null,
        },
      });

      await writeAuditLog(tx, {
        actorId: ctx.user.id,
        workspaceId: task.workspaceId,
        taskId: task.id,
        action: 'TASK_CREATED',
        entityType: 'Task',
        entityId: task.id,
        metadata: {
          title: task.title,
          status: task.status,
          priority: task.priority,
        },
      });

      return task;
    });
  }),

  list: protectedProcedure.input(listTasksSchema).query(async ({ ctx, input }) => {
    await assertCanCreateInWorkspace(ctx.prisma, {
      userId: ctx.user.id,
      systemRole: ctx.user.systemRole,
      workspaceId: input.workspaceId,
    });

    return ctx.prisma.task.findMany({
      where: {
        workspaceId: input.workspaceId,
        deletedAt: null,
        ...(input.projectId ? { projectId: input.projectId } : {}),
        ...(input.status ? { status: input.status } : {}),
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
  }),

  getById: taskProcedure
    .input(z.object({ taskId: entityIdSchema }).strict())
    .query(({ ctx }) => ctx.task),

  updateStatus: taskProcedure.input(updateTaskStatusSchema).mutation(async ({ ctx, input }) => {
    if (ctx.task.status !== input.fromStatus) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: `Task status is "${ctx.task.status}", expected "${input.fromStatus}"`,
      });
    }

    const result = await ctx.prisma.$transaction(async (tx) => {
      const task = await tx.task.update({
        where: { id: input.taskId },
        data: { status: input.toStatus },
      });

      await writeAuditLog(tx, {
        actorId: ctx.user.id,
        workspaceId: task.workspaceId,
        taskId: task.id,
        action: 'TASK_STATUS_CHANGED',
        entityType: 'Task',
        entityId: task.id,
        metadata: {
          fromStatus: input.fromStatus,
          toStatus: input.toStatus,
        },
      });

      let notification: Notification | null = null;
      if (task.assigneeId && task.assigneeId !== ctx.user.id) {
        notification = await tx.notification.create({
          data: {
            userId: task.assigneeId,
            title: 'Статус задачи обновлен',
            message: buildStatusChangeMessage({
              actorName: ctx.user.name,
              actorSystemRole: ctx.user.systemRole,
              actorWorkspaceRole: ctx.workspaceMembership?.workspaceRole ?? null,
              taskTitle: task.title,
              toStatus: input.toStatus,
            }),
          },
        });

        await writeAuditLog(tx, {
          actorId: ctx.user.id,
          workspaceId: task.workspaceId,
          taskId: task.id,
          action: 'NOTIFICATION_CREATED',
          entityType: 'Notification',
          entityId: notification.id,
          metadata: {
            recipientId: task.assigneeId,
            title: notification.title,
          },
        });
      }

      return { task, notification };
    });

    ee.emit(TASK_UPDATED_EVENT, result.task);
    if (result.notification) {
      ee.emit(NOTIFICATION_CREATED_EVENT, result.notification);
    }

    return result.task;
  }),

  softDelete: taskProcedure
    .input(z.object({ taskId: entityIdSchema }).strict())
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.$transaction(async (tx) => {
        const deleted = await tx.task.update({
          where: { id: input.taskId },
          data: { deletedAt: new Date() },
        });

        await writeAuditLog(tx, {
          actorId: ctx.user.id,
          workspaceId: deleted.workspaceId,
          taskId: deleted.id,
          action: 'TASK_SOFT_DELETED',
          entityType: 'Task',
          entityId: deleted.id,
        });

        return deleted;
      });
    }),

  addComment: taskProcedure.input(createCommentSchema).mutation(async ({ ctx, input }) => {
    return ctx.prisma.$transaction(async (tx) => {
      const comment = await tx.comment.create({
        data: {
          taskId: input.taskId,
          authorId: ctx.user.id,
          body: input.body,
        },
      });

      await writeAuditLog(tx, {
        actorId: ctx.user.id,
        workspaceId: ctx.task.workspaceId,
        taskId: input.taskId,
        action: 'COMMENT_CREATED',
        entityType: 'Comment',
        entityId: comment.id,
        metadata: { taskId: input.taskId },
      });

      return comment;
    });
  }),

  listComments: taskProcedure
    .input(z.object({ taskId: entityIdSchema }).strict())
    .query(({ ctx, input }) =>
      ctx.prisma.comment.findMany({
        where: { taskId: input.taskId },
        orderBy: { createdAt: 'asc' },
        include: {
          author: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
    ),

  onStatusChange: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .subscription(async ({ ctx, input }) => {
      await assertCanCreateInWorkspace(ctx.prisma, {
        userId: ctx.user.id,
        systemRole: ctx.user.systemRole,
        workspaceId: input.workspaceId,
      });

      return observable<Task>((emit) => {
        const onTaskUpdated = (task: Task) => {
          if (task.workspaceId !== input.workspaceId) {
            return;
          }

          emit.next(task);
        };

        ee.on(TASK_UPDATED_EVENT, onTaskUpdated);
        return () => {
          ee.off(TASK_UPDATED_EVENT, onTaskUpdated);
        };
      });
    }),
});
