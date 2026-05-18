import { Router } from 'express';
import Database from 'better-sqlite3';
import { requireOrganizer } from '../middleware/auth.js';

export function lockRouter(
  db: Database.Database,
  broadcast: (sessionId: string, data: any) => void
) {
  const router = Router();

  router.post('/:sessionId/lock', requireOrganizer, (req, res) => {
    const { sessionId } = req.params;
    const session = db
      .prepare('SELECT organizer_id FROM sessions WHERE id = ?')
      .get(sessionId) as { organizer_id: string } | undefined;
    if (!session) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    if (session.organizer_id !== req.user!.id) {
      res.status(403).json({ error: 'Not your session' });
      return;
    }
    db.prepare("UPDATE sessions SET status = 'locked' WHERE id = ?").run(sessionId);
    broadcast(sessionId, { type: 'session_locked' });
    res.json({ status: 'locked' });
  });

  return router;
}
