import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { observable } from '@trpc/server/observable';
import type { Notification } from '@prisma/client';
import { writeAuditLog } from '../../audit/audit-log';
import { ee, NOTIFICATION_CREATED_EVENT } from '../ee';
import { protectedProcedure, router } from '../trpc';

export const notificationRouter = router({
  listUnread: protectedProcedure.query(({ ctx }) =>
    ctx.prisma.notification.findMany({
      where: {
        userId: ctx.user.id,
        isRead: false,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ),

  markAsRead: protectedProcedure
    .input(z.object({ notificationId: z.string().cuid() }).strict())
    .mutation(async ({ ctx, input }) => {
      const notification = await ctx.prisma.notification.findUnique({
        where: { id: input.notificationId },
      });

      if (!notification || notification.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Notification not found',
        });
      }

      return ctx.prisma.$transaction(async (tx) => {
        const updated = await tx.notification.update({
          where: { id: input.notificationId },
          data: { isRead: true },
        });

        await writeAuditLog(tx, {
          actorId: ctx.user.id,
          action: 'NOTIFICATION_READ',
          entityType: 'Notification',
          entityId: updated.id,
        });

        return updated;
      });
    }),

  onNew: protectedProcedure.subscription(({ ctx }) =>
    observable<Notification>((emit) => {
      const onCreated = (notification: Notification) => {
        if (notification.userId !== ctx.user.id) {
          return;
        }

        emit.next(notification);
      };

      ee.on(NOTIFICATION_CREATED_EVENT, onCreated);
      return () => {
        ee.off(NOTIFICATION_CREATED_EVENT, onCreated);
      };
    }),
  ),
});
