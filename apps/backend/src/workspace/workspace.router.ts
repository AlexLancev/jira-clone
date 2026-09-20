import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Prisma } from '@prisma/client';
import { SystemRole, WorkspaceRole, hasSystemRoleAtLeast } from '@repo/shared';
import { writeAuditLog } from '../audit/audit-log';
import type { PrismaService } from '../prisma/prisma.service';
import { protectedProcedure, router } from '../trpc/trpc';

const entityIdSchema = z.string().trim().cuid();

const createWorkspaceSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .min(2)
      .max(48)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase kebab-case'),
  })
  .strict();

const createProjectSchema = z
  .object({
    workspaceId: entityIdSchema,
    name: z.string().trim().min(1).max(120),
    key: z
      .string()
      .trim()
      .toUpperCase()
      .min(2)
      .max(8)
      .regex(/^[A-Z][A-Z0-9]+$/, 'Project key must be uppercase alphanumeric'),
    description: z.string().trim().max(2000).nullable().optional(),
  })
  .strict();

async function assertWorkspaceAccess(
  prisma: PrismaService,
  userId: string,
  systemRole: SystemRole,
  workspaceId: string,
) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      members: {
        where: { userId },
      },
    },
  });

  if (!workspace) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Workspace not found' });
  }

  if (hasSystemRoleAtLeast(systemRole, SystemRole.MODERATOR)) {
    return workspace;
  }

  if (!workspace.members[0]) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You are not a member of this workspace',
    });
  }

  return workspace;
}

export const workspaceRouter = router({
  create: protectedProcedure.input(createWorkspaceSchema).mutation(async ({ ctx, input }) => {
    try {
      return await ctx.prisma.$transaction(async (tx) => {
        const workspace = await tx.workspace.create({
          data: {
            name: input.name,
            slug: input.slug,
            ownerId: ctx.user.id,
            members: {
              create: {
                userId: ctx.user.id,
                workspaceRole: WorkspaceRole.OWNER,
              },
            },
          },
        });

        await writeAuditLog(tx, {
          actorId: ctx.user.id,
          workspaceId: workspace.id,
          action: 'WORKSPACE_CREATED',
          entityType: 'Workspace',
          entityId: workspace.id,
          metadata: { name: workspace.name, slug: workspace.slug },
        });

        return workspace;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'A workspace with this slug already exists',
        });
      }
      throw error;
    }
  }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const workspaces = await ctx.prisma.workspace.findMany({
      where: hasSystemRoleAtLeast(ctx.user.systemRole, SystemRole.MODERATOR)
        ? undefined
        : {
            members: {
              some: { userId: ctx.user.id },
            },
          },
      include: {
        members: {
          where: { userId: ctx.user.id },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return workspaces.map(({ members, ...workspace }) => ({
      ...workspace,
      currentRole: (members[0]?.workspaceRole as WorkspaceRole | undefined) ?? null,
    }));
  }),

  get: protectedProcedure
    .input(z.object({ workspaceId: entityIdSchema }).strict())
    .query(async ({ ctx, input }) => {
      const workspace = await assertWorkspaceAccess(
        ctx.prisma,
        ctx.user.id,
        ctx.user.systemRole,
        input.workspaceId,
      );
      const membership = workspace.members[0] ?? null;

      return {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        ownerId: workspace.ownerId,
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
        currentRole: (membership?.workspaceRole as WorkspaceRole | undefined) ?? null,
      };
    }),

  createProject: protectedProcedure.input(createProjectSchema).mutation(async ({ ctx, input }) => {
    await assertWorkspaceAccess(ctx.prisma, ctx.user.id, ctx.user.systemRole, input.workspaceId);

    try {
      return await ctx.prisma.$transaction(async (tx) => {
        const project = await tx.project.create({
          data: {
            workspaceId: input.workspaceId,
            name: input.name,
            key: input.key,
            description: input.description ?? null,
          },
        });

        await writeAuditLog(tx, {
          actorId: ctx.user.id,
          workspaceId: input.workspaceId,
          action: 'PROJECT_CREATED',
          entityType: 'Project',
          entityId: project.id,
          metadata: { name: project.name, key: project.key },
        });

        return project;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'A project with this key already exists in the workspace',
        });
      }
      throw error;
    }
  }),

  listProjects: protectedProcedure
    .input(z.object({ workspaceId: entityIdSchema }).strict())
    .query(async ({ ctx, input }) => {
      await assertWorkspaceAccess(ctx.prisma, ctx.user.id, ctx.user.systemRole, input.workspaceId);

      return ctx.prisma.project.findMany({
        where: { workspaceId: input.workspaceId },
        orderBy: { createdAt: 'desc' },
      });
    }),
});
