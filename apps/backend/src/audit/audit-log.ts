import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';

type TransactionClient = Prisma.TransactionClient | PrismaService;

export async function writeAuditLog(
  tx: TransactionClient,
  entry: {
    actorId?: string | null;
    workspaceId?: string | null;
    taskId?: string | null;
    action: string;
    entityType: string;
    entityId: string;
    metadata?: Prisma.InputJsonValue;
  },
): Promise<void> {
  await tx.auditLog.create({
    data: {
      actorId: entry.actorId ?? null,
      workspaceId: entry.workspaceId ?? null,
      taskId: entry.taskId ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      metadata: entry.metadata ?? undefined,
    },
  });
}
