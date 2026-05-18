import { Router } from 'express';
import type Database from 'better-sqlite3';
import { nanoid } from 'nanoid';
import { randomBytes } from 'crypto';
import { AUTH_COOKIE } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import type { Mailer } from '../services/mailer.js';
import type { TurnstileVerifier } from '../services/turnstile.js';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MAGIC_LINK_TTL_MS = 15 * 60 * 1000; // 15 min
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function newToken(): string {
  return randomBytes(32).toString('hex');
}

function normaliseEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim().toLowerCase();
  if (!EMAIL_RE.test(v)) return null;
  return v;
}

function safeNextPath(raw: unknown): string {
  if (typeof raw !== 'string') return '/';
  // Only allow same-origin relative paths starting with a single slash.
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/';
  return raw;
}

export interface AuthRouterDeps {
  db: Database.Database;
  mailer: Mailer;
  turnstile: TurnstileVerifier;
  appUrl: string;
  cookieSecure: boolean;
}

export function authRouter({
  db,
  mailer,
  turnstile,
  appUrl,
  cookieSecure,
}: AuthRouterDeps) {
  const router = Router();

  const requestLimiters = [
    rateLimit({ windowMs: 60 * 60 * 1000, max: 5 }),
    rateLimit({ windowMs: 24 * 60 * 60 * 1000, max: 20 }),
  ];

  router.post('/request', ...requestLimiters, async (req, res) => {
    const email = normaliseEmail(req.body?.email);
    if (!email) {
      res.status(400).json({ error: 'Valid email required' });
      return;
    }

    if (turnstile.enabled) {
      const ok = await turnstile.verify(req.body?.turnstile, req.ip);
      if (!ok) {
        res.status(400).json({ error: 'CAPTCHA failed — please try again.' });
        return;
      }
    }

    const next = safeNextPath(req.body?.next);
    const token = newToken();
    const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MS).toISOString();

    db.prepare(
      'INSERT INTO magic_links (token, email, expires_at) VALUES (?, ?, ?)',
    ).run(token, email, expiresAt);

    const link = `${appUrl}/api/auth/verify?token=${token}&next=${encodeURIComponent(next)}`;

    try {
      await mailer.sendMagicLink({ to: email, link });
    } catch (err) {
      console.error('[auth] mailer failed', err);
      // Don't leak the failure to the caller — they shouldn't be able to
      // probe whether an email exists/is deliverable. Status 202 either way.
    }

    res.status(202).json({ ok: true });
  });

  router.get('/verify', (req, res) => {
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    const next = safeNextPath(req.query.next);
    if (!token) {
      res.status(400).json({ error: 'Token required' });
      return;
    }

    const row = db
      .prepare('SELECT email, expires_at, used_at FROM magic_links WHERE token = ?')
      .get(token) as
      | { email: string; expires_at: string; used_at: string | null }
      | undefined;

    if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) {
      res.status(400).json({ error: 'Invalid or expired link' });
      return;
    }

    // Consume the link.
    db.prepare("UPDATE magic_links SET used_at = datetime('now') WHERE token = ?").run(token);

    // Upsert user.
    let user = db
      .prepare('SELECT id FROM users WHERE email = ?')
      .get(row.email) as { id: string } | undefined;
    if (!user) {
      const id = nanoid(12);
      db.prepare('INSERT INTO users (id, email) VALUES (?, ?)').run(id, row.email);
      user = { id };
    }
    db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(user.id);

    // Create auth session.
    const sessionToken = newToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    db.prepare(
      'INSERT INTO auth_sessions (token, user_id, expires_at) VALUES (?, ?, ?)',
    ).run(sessionToken, user.id, expiresAt);

    res.cookie(AUTH_COOKIE, sessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: cookieSecure,
      path: '/',
      maxAge: SESSION_TTL_MS,
    });

    res.redirect(next);
  });

  router.post('/logout', (req, res) => {
    const cookieHeader = req.headers.cookie || '';
    const match = cookieHeader.match(new RegExp(`${AUTH_COOKIE}=([^;]+)`));
    if (match) {
      db.prepare('DELETE FROM auth_sessions WHERE token = ?').run(match[1]);
    }
    res.clearCookie(AUTH_COOKIE, { path: '/' });
    res.json({ ok: true });
  });

  router.get('/me', (req, res) => {
    if (!req.user) {
      res.status(200).json({ user: null });
      return;
    }
    res.json({ user: req.user });
  });

  return router;
}
