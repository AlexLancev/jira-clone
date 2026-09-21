import { SystemRole } from '@repo/shared';
import jwt, { type SignOptions } from 'jsonwebtoken';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  systemRole: SystemRole;
}

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return secret;
}

export function getJwtExpiresIn(): SignOptions['expiresIn'] {
  return (process.env.JWT_EXPIRES_IN ?? '7d') as SignOptions['expiresIn'];
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: getJwtExpiresIn() });
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    if (typeof decoded !== 'object' || decoded === null) {
      return null;
    }

    const { sub, email, systemRole } = decoded as Partial<AccessTokenPayload>;
    if (
      typeof sub !== 'string' ||
      typeof email !== 'string' ||
      (systemRole !== SystemRole.ADMIN &&
        systemRole !== SystemRole.MODERATOR &&
        systemRole !== SystemRole.USER)
    ) {
      return null;
    }

    return { sub, email, systemRole };
  } catch {
    return null;
  }
}
