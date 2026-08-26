import { PrismaClient, TaskPriority, TaskStatus, WorkspaceRole } from '@prisma/client';
import { SystemRole } from '@repo/shared';
import { hashPassword } from '../src/auth/password';

const prisma = new PrismaClient();

const SEED_PASSWORD = 'password123';

async function main(): Promise<void> {
  const passwordHash = await hashPassword(SEED_PASSWORD);

  await prisma.$transaction(async (tx) => {
    const admin = await tx.user.upsert({
      where: { email: 'admin@test.com' },
      update: {
        name: 'Ada Admin',
        systemRole: SystemRole.ADMIN,
        passwordHash,
      },
      create: {
        email: 'admin@test.com',
        name: 'Ada Admin',
        systemRole: SystemRole.ADMIN,
        passwordHash,
      },
    });

    const moderator = await tx.user.upsert({
      where: { email: 'moderator@test.com' },
      update: {
        name: 'Morgan Moderator',
        systemRole: SystemRole.MODERATOR,
        passwordHash,
      },
      create: {
        email: 'moderator@test.com',
        name: 'Morgan Moderator',
        systemRole: SystemRole.MODERATOR,
        passwordHash,
      },
    });

    const member = await tx.user.upsert({
      where: { email: 'user@test.com' },
      update: {
        name: 'Uma User',
        systemRole: SystemRole.USER,
        passwordHash,
      },
      create: {
        email: 'user@test.com',
        name: 'Uma User',
        systemRole: SystemRole.USER,
        passwordHash,
      },
    });

    const workspace = await tx.workspace.upsert({
      where: { slug: 'acme-enterprise' },
      update: {
        name: 'Acme Enterprise',
        ownerId: admin.id,
      },
      create: {
        name: 'Acme Enterprise',
        slug: 'acme-enterprise',
        ownerId: admin.id,
      },
    });

    await tx.workspaceMember.upsert({
      where: {
        workspaceId_userId: { workspaceId: workspace.id, userId: admin.id },
      },
      update: { workspaceRole: WorkspaceRole.OWNER },
      create: {
        workspaceId: workspace.id,
        userId: admin.id,
        workspaceRole: WorkspaceRole.OWNER,
      },
    });

    await tx.workspaceMember.upsert({
      where: {
        workspaceId_userId: { workspaceId: workspace.id, userId: moderator.id },
      },
      update: { workspaceRole: WorkspaceRole.MANAGER },
      create: {
        workspaceId: workspace.id,
        userId: moderator.id,
        workspaceRole: WorkspaceRole.MANAGER,
      },
    });

    await tx.workspaceMember.upsert({
      where: {
        workspaceId_userId: { workspaceId: workspace.id, userId: member.id },
      },
      update: { workspaceRole: WorkspaceRole.MEMBER },
      create: {
        workspaceId: workspace.id,
        userId: member.id,
        workspaceRole: WorkspaceRole.MEMBER,
      },
    });

    const project = await tx.project.upsert({
      where: {
        workspaceId_key: { workspaceId: workspace.id, key: 'CORE' },
      },
      update: {
        name: 'Core Engine v1',
        description: 'Primary delivery track for the Acme platform core.',
      },
      create: {
        workspaceId: workspace.id,
        name: 'Core Engine v1',
        key: 'CORE',
        description: 'Primary delivery track for the Acme platform core.',
      },
    });

    await tx.task.deleteMany({
      where: { workspaceId: workspace.id },
    });

    const tasks = [
      {
        title: 'Draft public API contract',
        description: 'Capture request/response shapes for the core engine v1 endpoints.',
        status: TaskStatus.BACKLOG,
        priority: TaskPriority.LOW,
        estimatePoints: 3,
        dueDate: null as Date | null,
      },
      {
        title: 'Inventory schema spike',
        description: 'Explore SQLite constraints for multi-tenant inventory records.',
        status: TaskStatus.BACKLOG,
        priority: TaskPriority.MEDIUM,
        estimatePoints: 5,
        dueDate: daysFromNow(14),
      },
      {
        title: 'Harden session cookies',
        description: 'Confirm HttpOnly + SameSite cookie flags on the auth flow.',
        status: TaskStatus.TODO,
        priority: TaskPriority.HIGH,
        estimatePoints: 2,
        dueDate: daysFromNow(5),
      },
      {
        title: 'Fix login rate limiter',
        description: 'Add backoff for repeated failed password attempts.',
        status: TaskStatus.TODO,
        priority: TaskPriority.URGENT,
        estimatePoints: 8,
        dueDate: daysFromNow(2),
      },
      {
        title: 'Kanban optimistic rollback',
        description: 'Verify illegal TaskStatus transitions snap cards back instantly.',
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.HIGH,
        estimatePoints: 5,
        dueDate: daysFromNow(3),
      },
    ];

    for (const task of tasks) {
      const created = await tx.task.create({
        data: {
          workspaceId: workspace.id,
          projectId: project.id,
          creatorId: admin.id,
          assigneeId: member.id,
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          estimatePoints: task.estimatePoints,
          dueDate: task.dueDate,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          workspaceId: workspace.id,
          taskId: created.id,
          action: 'TASK_SEEDED',
          entityType: 'Task',
          entityId: created.id,
          metadata: {
            title: created.title,
            status: created.status,
            priority: created.priority,
          },
        },
      });
    }

    await tx.auditLog.create({
      data: {
        actorId: admin.id,
        workspaceId: workspace.id,
        action: 'WORKSPACE_SEEDED',
        entityType: 'Workspace',
        entityId: workspace.id,
        metadata: {
          slug: workspace.slug,
          members: [admin.email, moderator.email, member.email],
        },
      },
    });
  });

  console.log('Seed complete.');
  console.log('  admin@test.com      / password123  (ADMIN, workspace OWNER)');
  console.log('  moderator@test.com  / password123  (MODERATOR, workspace MANAGER)');
  console.log('  user@test.com       / password123  (USER, workspace MEMBER)');
}

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
