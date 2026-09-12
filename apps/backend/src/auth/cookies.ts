export const ACCESS_TOKEN_COOKIE = 'access_token';

export function readCookie(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) {
    return undefined;
  }

  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const trimmed = part.trim();
    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex);
    if (key !== name) {
      continue;
    }

    return decodeURIComponent(trimmed.slice(equalsIndex + 1));
  }

  return undefined;
}

export function serializeAuthCookie(token: string, maxAgeSeconds: number): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${ACCESS_TOKEN_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}

export function serializeClearedAuthCookie(): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${ACCESS_TOKEN_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}
