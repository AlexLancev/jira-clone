import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString('hex')}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const separatorIndex = storedHash.indexOf(':');
  if (separatorIndex <= 0) {
    return false;
  }

  const salt = storedHash.slice(0, separatorIndex);
  const hash = storedHash.slice(separatorIndex + 1);
  const stored = Buffer.from(hash, 'hex');
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;

  if (stored.length !== derivedKey.length) {
    return false;
  }

  return timingSafeEqual(stored, derivedKey);
}
