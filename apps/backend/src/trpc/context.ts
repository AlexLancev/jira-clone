import type { IncomingMessage, ServerResponse } from 'node:http';
import { SystemRole } from '@repo/shared';
import type { PrismaService } from '../prisma/prisma.service';
import { ACCESS_TOKEN_COOKIE, readCookie } from '../auth/cookies';
import { verifyAccessToken } from '../auth/jwt';

export interface ContextUser {
  id: string;
  email: string;
  name: string;
  systemRole: SystemRole;
}

export interface CookieWritable {
  setHeader(name: string, value: string | number | readonly string[]): unknown;
}

export interface CreateTrpcContextOptions {
  req: IncomingMessage & { headers: IncomingMessage['headers'] };
  res: CookieWritable | null;
  prisma: PrismaService;
  connectionParams?: Record<string, unknown> | null;
}

export interface TrpcContext {
  prisma: PrismaService;
  req: CreateTrpcContextOptions['req'];
  res: CookieWritable | null;
  user: ContextUser | null;
}

function extractBearerToken(authorizationHeader: string | undefined): string | undefined {
  if (!authorizationHeader) {
    return undefined;
  }

  const match = /^Bearer\s+(.+)$/i.exec(authorizationHeader.trim());
  const token = match?.[1]?.trim();
  return token && token.length > 0 ? token : undefined;
}

function extractConnectionParamToken(
  connectionParams: Record<string, unknown> | null | undefined,
): string | undefined {
  if (!connectionParams) {
    return undefined;
  }

  const raw = connectionParams.token ?? connectionParams.authorization;
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return undefined;
  }

  return extractBearerToken(raw) ?? raw.trim();
}

function extractAccessToken(
  req: CreateTrpcContextOptions['req'],
  connectionParams?: Record<string, unknown> | null,
): string | undefined {
  const headerValue = req.headers.authorization;
  const fromHeader = extractBearerToken(
    Array.isArray(headerValue) ? headerValue[0] : headerValue,
  );
  if (fromHeader) {
    return fromHeader;
  }

  const fromParams = extractConnectionParamToken(connectionParams);
  if (fromParams) {
    return fromParams;
  }

  const cookieHeader = req.headers.cookie;
  return readCookie(Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader, ACCESS_TOKEN_COOKIE);
}

export async function createTrpcContext(
  options: CreateTrpcContextOptions,
): Promise<TrpcContext> {
  const { req, res, prisma, connectionParams } = options;
  const token = extractAccessToken(req, connectionParams);

  if (!token) {
    return { prisma, req, res, user: null };
  }

  const payload = verifyAccessToken(token);
  if (!payload) {
    return { prisma, req, res, user: null };
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      email: true,
      name: true,
      systemRole: true,
    },
  });

  if (!user) {
    return { prisma, req, res, user: null };
  }

  return {
    prisma,
    req,
    res,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      systemRole: user.systemRole as SystemRole,
    },
  };
}
