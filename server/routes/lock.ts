import { Router } from 'express';
import Database from 'better-sqlite3';

export function lockRouter(
  db: Database.Database,
  broadcast: (sessionId: string, data: any) => void
) {
  const router = Router();

  router.post('/:sessionId/lock', (req, res) => {
    const { sessionId } = req.params;
    db.prepare("UPDATE sessions SET status = 'locked' WHERE id = ?").run(sessionId);
    broadcast(sessionId, { type: 'session_locked' });
    res.json({ status: 'locked' });
  });

  return router;
}
