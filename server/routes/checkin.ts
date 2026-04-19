import { Router } from 'express';
import Database from 'better-sqlite3';
import { nanoid } from 'nanoid';

export function checkinRouter(db: Database.Database) {
  const router = Router();

  router.post('/', (req, res) => {
    const { sessionId, displayName, phone, minivanId } = req.body;

    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId) as any;
    if (!session || session.status !== 'active') {
      return res.status(400).json({ error: 'Session is not accepting check-ins' });
    }

    const sessionToken = nanoid(16);

    db.prepare(
      'INSERT INTO canvassers (session_id, display_name, phone, minivan_id, session_token) VALUES (?, ?, ?, ?, ?)'
    ).run(sessionId, displayName, phone || null, minivanId || null, sessionToken);

    res.status(201).json({ sessionToken, displayName, sessionId });
  });

  return router;
}
