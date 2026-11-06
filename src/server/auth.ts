import { createHash, randomBytes } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';
import type { Db } from './db/pool.js';
import { tx } from './db/pool.js';
import { emit } from './core/workflow.js';

export const SESSION_COOKIE = 'candy_sid';
export const SESSION_DAYS = 7;

export interface SessionUser {
  id: string;
  email: string;
  display_name: string;
  role: 'owner' | 'clinical_reviewer' | 'reviewer';
  interface_locale: 'en' | 'ms';
  content_locale: 'en' | 'ms';
  onboarding_done: boolean;
}

const USER_COLS = 'u.id, u.email, u.display_name, u.role, u.interface_locale, u.content_locale, u.onboarding_done';

/** The cookie carries a random token; the database stores only its SHA-256. */
export const sessionIdFor = (token: string) => createHash('sha256').update(token).digest('hex');

let dummyHash: Promise<string> | null = null;
/** Verify against a throwaway hash when the email is unknown, so timing does not reveal which emails exist. */
const dummy = () => (dummyHash ??= hash(randomBytes(16).toString('hex')));

export async function login(db: Db, email: string, password: string, userAgent?: string): Promise<{ token: string; user: SessionUser } | null> {
  const u = (await db.query(`SELECT ${USER_COLS}, u.password_hash FROM users u WHERE lower(u.email)=lower($1)`, [email])).rows[0];
  const ok = u ? await verify(u.password_hash, password).catch(() => false) : (await verify(await dummy(), password).catch(() => false), false);
  if (!u || !ok) return null;
  const token = randomBytes(32).toString('base64url');
  await tx(db, async (c) => {
    await c.query(`DELETE FROM sessions WHERE expires_at <= now()`);
    await c.query(
      `INSERT INTO sessions (id, user_id, expires_at, user_agent) VALUES ($1,$2, now() + make_interval(days => $3), $4)`,
      [sessionIdFor(token), u.id, SESSION_DAYS, userAgent?.slice(0, 300) ?? null]);
    await emit(c, { kind: 'human', userId: u.id }, 'auth.login');
  });
  delete u.password_hash;
  return { token, user: u as SessionUser };
}

export async function userForToken(db: Db, token: string | undefined): Promise<SessionUser | null> {
  if (!token || token.length > 200) return null;
  const r = await db.query(
    `UPDATE sessions s SET last_seen_at=now() FROM users u
      WHERE s.id=$1 AND s.user_id=u.id AND s.expires_at > now()
      RETURNING ${USER_COLS}`, [sessionIdFor(token)]);
  return (r.rows[0] as SessionUser) ?? null;
}

export async function logout(db: Db, token: string, userId: string) {
  await tx(db, async (c) => {
    await c.query(`DELETE FROM sessions WHERE id=$1`, [sessionIdFor(token)]);
    await emit(c, { kind: 'human', userId }, 'auth.logout');
  });
}

/** Sign out everywhere (e.g. after a password reset). */
export async function revokeAllSessions(db: Db, userId: string) {
  await db.query(`DELETE FROM sessions WHERE user_id=$1`, [userId]);
}

export async function setPassword(db: Db, userId: string, password: string) {
  if (password.length < 12) throw new Error('Password must be at least 12 characters');
  await db.query(`UPDATE users SET password_hash=$2 WHERE id=$1`, [userId, await hash(password)]);
  await revokeAllSessions(db, userId);
}

// ---------- Cookies ----------
export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) { try { out[k] = decodeURIComponent(v); } catch { out[k] = v; } }
  }
  return out;
}

export function sessionCookie(token: string, secure: boolean) {
  return `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_DAYS * 86400}${secure ? '; Secure' : ''}`;
}
export function clearedCookie(secure: boolean) {
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure ? '; Secure' : ''}`;
}

// ---------- Login throttling ----------
/** 5 failed attempts per email+IP within 15 minutes locks that pair for the rest of the window. */
export class LoginThrottle {
  private failures = new Map<string, { count: number; first: number }>();
  constructor(private max = 5, private windowMs = 15 * 60_000) {}
  private key(email: string, ip: string) { return `${email.toLowerCase()}|${ip}`; }
  blocked(email: string, ip: string): number {
    const f = this.failures.get(this.key(email, ip));
    if (!f) return 0;
    const left = f.first + this.windowMs - Date.now();
    if (left <= 0) { this.failures.delete(this.key(email, ip)); return 0; }
    return f.count >= this.max ? left : 0;
  }
  fail(email: string, ip: string) {
    const k = this.key(email, ip);
    const f = this.failures.get(k);
    if (!f || f.first + this.windowMs < Date.now()) this.failures.set(k, { count: 1, first: Date.now() });
    else f.count++;
  }
  succeed(email: string, ip: string) { this.failures.delete(this.key(email, ip)); }
}
