import type Database from 'better-sqlite3';
import { nanoid } from 'nanoid';
import { randomBytes } from 'crypto';
import { AUTH_COOKIE } from '../middleware/auth.js';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Seed a verified organizer + active auth session directly in the DB.
 * Returns a Cookie header string ready to pass to supertest `.set('Cookie', cookie)`.
 */
export function seedAuthedUser(
  db: Database.Database,
  email = 'org-1@example.com',
): { cookie: string; userId: string; email: string } {
  const userId = nanoid(12);
  db.prepare('INSERT INTO users (id, email) VALUES (?, ?)').run(userId, email);

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + ONE_DAY_MS).toISOString();
  db.prepare(
    'INSERT INTO auth_sessions (token, user_id, expires_at) VALUES (?, ?, ?)',
  ).run(token, userId, expiresAt);

  return { cookie: `${AUTH_COOKIE}=${token}`, userId, email };
}
