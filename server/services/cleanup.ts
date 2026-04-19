import Database from 'better-sqlite3';

export function purgeExpiredSessions(db: Database.Database): number {
  const expired = db.prepare(
    "SELECT id FROM sessions WHERE expires_at < datetime('now')"
  ).all() as { id: string }[];

  for (const session of expired) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(session.id);
  }

  return expired.length;
}
