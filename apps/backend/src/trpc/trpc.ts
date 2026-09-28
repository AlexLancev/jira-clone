import { TRPCError } from '@trpc/server';
import type { TrpcContext } from './context';
import { t } from './init';
import { taskAccessMiddleware } from './task-access.middleware';

export const router = t.router;
export const middleware = t.middleware;
export const mergeRouters = t.mergeRouters;

export const publicProcedure = t.procedure;

const isAuthenticated = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(isAuthenticated);

export const taskProcedure = protectedProcedure.use(taskAccessMiddleware);

export type AuthenticatedContext = TrpcContext & {
  user: NonNullable<TrpcContext['user']>;
};
