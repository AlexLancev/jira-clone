import { z } from 'zod';
import { protectedProcedure, router } from '../trpc';
import { auditAccessMiddleware } from '../audit-access.middleware';

const auditProcedure = protectedProcedure.use(auditAccessMiddleware);

const listAuditInputSchema = z
  .object({
    workspaceId: z.string().min(1),
    userId: z.string().min(1).optional(),
    action: z.string().min(1).optional(),
    limit: z.number().int().min(1).max(100).default(20),
    cursor: z.string().min(1).optional(),
  })
  .strict();

const summaryAuditInputSchema = z
  .object({
    workspaceId: z.string().min(1),
  })
  .strict();

const auditActorSelect = {
  id: true,
  name: true,
  email: true,
  systemRole: true,
} as const;

const auditTaskSelect = {
  id: true,
  title: true,
  status: true,
  deletedAt: true,
} as const;

export const auditRouter = router({
  list: auditProcedure.input(listAuditInputSchema).query(async ({ ctx, input }) => {
    const records = await ctx.prisma.auditLog.findMany({
      where: {
        workspaceId: input.workspaceId,
        ...(input.userId ? { actorId: input.userId } : {}),
        ...(input.action ? { action: input.action } : {}),
      },
      take: input.limit + 1,
      ...(input.cursor
        ? {
            cursor: { id: input.cursor },
            skip: 1,
          }
        : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        actor: { select: auditActorSelect },
        task: { select: auditTaskSelect },
      },
    });

    const hasMore = records.length > input.limit;
    const items = hasMore ? records.slice(0, input.limit) : records;
    const lastItem = items[items.length - 1];

    return {
      items,
      nextCursor: hasMore && lastItem ? lastItem.id : null,
    };
  }),

  summary: auditProcedure.input(summaryAuditInputSchema).query(async ({ ctx, input }) => {
    const where = { workspaceId: input.workspaceId };
    const totalMutations = await ctx.prisma.auditLog.count({ where });

    const actorGroups = await ctx.prisma.auditLog.groupBy({
      by: ['actorId'],
      where: { ...where, actorId: { not: null } },
      _count: { actorId: true },
      orderBy: { _count: { actorId: 'desc' } },
      take: 1,
    });

    const taskGroups = await ctx.prisma.auditLog.groupBy({
      by: ['taskId'],
      where: { ...where, taskId: { not: null } },
      _count: { taskId: true },
      orderBy: { _count: { taskId: 'desc' } },
      take: 1,
    });

    const topActorGroup = actorGroups[0];
    const topTaskGroup = taskGroups[0];

    const [topContributor, mostModifiedTask] = await Promise.all([
      topActorGroup?.actorId
        ? ctx.prisma.user.findUnique({
            where: { id: topActorGroup.actorId },
            select: auditActorSelect,
          })
        : Promise.resolve(null),
      topTaskGroup?.taskId
        ? ctx.prisma.task.findUnique({
            where: { id: topTaskGroup.taskId },
            select: auditTaskSelect,
          })
        : Promise.resolve(null),
    ]);

    return {
      totalMutations,
      topContributor: topContributor
        ? {
            ...topContributor,
            mutationCount: topActorGroup?._count.actorId ?? 0,
          }
        : null,
      mostModifiedTask: mostModifiedTask
        ? {
            ...mostModifiedTask,
            mutationCount: topTaskGroup?._count.taskId ?? 0,
          }
        : null,
    };
  }),
});
