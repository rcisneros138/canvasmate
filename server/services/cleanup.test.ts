import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase } from '../db/index';
import { purgeExpiredSessions } from './cleanup';

describe('purgeExpiredSessions', () => {
  let db: ReturnType<typeof createDatabase>;

  beforeEach(() => {
    db = createDatabase(':memory:');
    // Insert expired session
    db.prepare(
      "INSERT INTO sessions (id, name, organizer_id, status, expires_at) VALUES (?, ?, ?, ?, datetime('now', '-1 hour'))"
    ).run('expired-1', 'Old Session', 'org-1', 'closed');
    db.prepare(
      "INSERT INTO canvassers (session_id, display_name, phone, session_token) VALUES (?, ?, ?, ?)"
    ).run('expired-1', 'Alice', '+15551234567', 'tok-1');

    // Insert active session
    db.prepare(
      "INSERT INTO sessions (id, name, organizer_id, status, expires_at) VALUES (?, ?, ?, ?, datetime('now', '+23 hours'))"
    ).run('active-1', 'Current Session', 'org-1', 'active');
  });

  it('deletes expired sessions and their canvassers', () => {
    const purged = purgeExpiredSessions(db);
    expect(purged).toBe(1);

    const sessions = db.prepare('SELECT * FROM sessions').all();
    expect(sessions).toHaveLength(1);

    const canvassers = db.prepare('SELECT * FROM canvassers').all();
    expect(canvassers).toHaveLength(0);
  });
});
