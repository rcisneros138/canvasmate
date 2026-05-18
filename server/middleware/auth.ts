import type { Request, Response, NextFunction } from 'express';
import type Database from 'better-sqlite3';

export const AUTH_COOKIE = 'cm_auth';

export interface AuthUser {
  id: string;
  email: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

export function readAuth(db: Database.Database) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies[AUTH_COOKIE];
    if (!token) return next();

    const row = db
      .prepare(
        `SELECT u.id AS id, u.email AS email, s.expires_at AS expires_at
         FROM auth_sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token = ?`,
      )
      .get(token) as { id: string; email: string; expires_at: string } | undefined;

    if (!row) return next();
    if (new Date(row.expires_at).getTime() < Date.now()) {
      // expired — clean it up
      db.prepare('DELETE FROM auth_sessions WHERE token = ?').run(token);
      return next();
    }

    req.user = { id: row.id, email: row.email };
    db.prepare("UPDATE auth_sessions SET last_seen_at = datetime('now') WHERE token = ?").run(token);
    next();
  };
}

export function requireOrganizer(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'Sign in required' });
    return;
  }
  next();
}
