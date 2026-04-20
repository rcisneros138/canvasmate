import { Router } from 'express';
import Database from 'better-sqlite3';
import { SignalService } from '../services/signal';

export function lockRouter(
  db: Database.Database,
  signal: SignalService,
  broadcast: (sessionId: string, data: any) => void
) {
  const router = Router();

  router.post('/:sessionId/lock', async (req, res) => {
    const { sessionId } = req.params;
    db.prepare("UPDATE sessions SET status = 'locked' WHERE id = ?").run(sessionId);

    // Get the registered Signal number
    const signalRow = db.prepare("SELECT value FROM settings WHERE key = 'signal_number'").get() as any;
    const senderNumber = signalRow?.value;

    if (senderNumber) {
      const groups = db.prepare('SELECT * FROM groups WHERE session_id = ?').all(sessionId) as any[];
      const session = db.prepare('SELECT name FROM sessions WHERE id = ?').get(sessionId) as any;

      for (const group of groups) {
        const result = await signal.createGroup(`${session.name} - ${group.name}`, senderNumber);
        if (result.link) {
          db.prepare('UPDATE groups SET signal_group_link = ? WHERE id = ?').run(result.link, group.id);
        }
      }
    }

    // Include updated groups in broadcast
    const updatedGroups = db.prepare('SELECT * FROM groups WHERE session_id = ?').all(sessionId);
    broadcast(sessionId, { type: 'session_locked', groups: updatedGroups });
    res.json({ status: 'locked' });
  });

  return router;
}
