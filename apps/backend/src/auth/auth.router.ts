import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Prisma } from '@prisma/client';
import { SystemRole } from '@repo/shared';
import { writeAuditLog } from '../audit/audit-log';
import { serializeAuthCookie, serializeClearedAuthCookie } from '../auth/cookies';
import { signAccessToken } from '../auth/jwt';
import { hashPassword, verifyPassword } from '../auth/password';
import { protectedProcedure, publicProcedure, router } from '../trpc/trpc';

const registerInputSchema = z
  .object({
    email: z.string().trim().email().max(320).toLowerCase(),
    name: z.string().trim().min(1).max(120),
    password: z.string().min(8).max(128),
  })
  .strict();

const loginInputSchema = z
  .object({
    email: z.string().trim().email().max(320).toLowerCase(),
    password: z.string().min(1).max(128),
  })
  .strict();

function jwtMaxAgeSeconds(): number {
  const raw = process.env.JWT_EXPIRES_IN ?? '7d';
  const match = /^(\d+)([smhd])$/.exec(raw);
  if (!match || !match[1] || !match[2]) {
    return 60 * 60 * 24 * 7;
  }

  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return amount * (multipliers[unit] ?? 86400);
}

function toPublicUser(user: { id: string; email: string; name: string; systemRole: SystemRole }) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    systemRole: user.systemRole,
  };
}

export const authRouter = router({
  register: publicProcedure.input(registerInputSchema).mutation(async ({ ctx, input }) => {
    const passwordHash = await hashPassword(input.password);

    try {
      const user = await ctx.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email: input.email,
            name: input.name,
            passwordHash,
            systemRole: SystemRole.USER,
          },
        });

        await writeAuditLog(tx, {
          actorId: created.id,
          action: 'USER_REGISTERED',
          entityType: 'User',
          entityId: created.id,
          metadata: { email: created.email },
        });

        return created;
      });

      const token = signAccessToken({
        sub: user.id,
        email: user.email,
        systemRole: user.systemRole as SystemRole,
      });
      ctx.res?.setHeader('Set-Cookie', serializeAuthCookie(token, jwtMaxAgeSeconds()));

      return {
        token,
        user: toPublicUser({
          id: user.id,
          email: user.email,
          name: user.name,
          systemRole: user.systemRole as SystemRole,
        }),
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'A user with this email already exists',
        });
      }
      throw error;
    }
  }),

  login: publicProcedure.input(loginInputSchema).mutation(async ({ ctx, input }) => {
    const user = await ctx.prisma.user.findUnique({
      where: { email: input.email },
    });

    if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Invalid email or password',
      });
    }

    await ctx.prisma.$transaction(async (tx) => {
      await writeAuditLog(tx, {
        actorId: user.id,
        action: 'USER_LOGGED_IN',
        entityType: 'User',
        entityId: user.id,
      });
    });

    const token = signAccessToken({
      sub: user.id,
      email: user.email,
      systemRole: user.systemRole as SystemRole,
    });
    ctx.res?.setHeader('Set-Cookie', serializeAuthCookie(token, jwtMaxAgeSeconds()));

    return {
      token,
      user: toPublicUser({
        id: user.id,
        email: user.email,
        name: user.name,
        systemRole: user.systemRole as SystemRole,
      }),
    };
  }),

  logout: publicProcedure.mutation(({ ctx }) => {
    ctx.res?.setHeader('Set-Cookie', serializeClearedAuthCookie());
    return { success: true as const };
  }),

  me: protectedProcedure.query(({ ctx }) => toPublicUser(ctx.user)),
});
