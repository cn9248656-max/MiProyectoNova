import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { db } from './db';
import { getUserById } from './store';
import type { PublicUser } from './types';

const COOKIE_NAME = 'nova_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function getSecret(): string {
  const row = db().prepare("SELECT value FROM settings WHERE key = 'session_secret'").get() as
    | { value: string }
    | undefined;
  return row?.value ?? 'novastore-fallback-secret';
}

export function createSessionToken(userId: string): string {
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp: Date.now() + MAX_AGE_SECONDS * 1000 })).toString(
    'base64url'
  );
  const sig = crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { uid?: string; exp?: number };
    if (!data.uid || typeof data.exp !== 'number' || data.exp < Date.now()) return null;
    return data.uid;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<PublicUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const userId = verifySessionToken(token);
  if (!userId) return null;
  return getUserById(userId);
}

export async function getAdminUser(): Promise<PublicUser | null> {
  const user = await getCurrentUser();
  return user && user.role === 'ADMIN' ? user : null;
}

export async function setSessionCookie(userId: string): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_NAME, createSessionToken(userId), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
    secure: process.env.NODE_ENV === 'production',
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}
