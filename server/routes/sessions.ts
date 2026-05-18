import { Router } from 'express';
import Database from 'better-sqlite3';
import { nanoid } from 'nanoid';
import Papa from 'papaparse';
import { requireOrganizer } from '../middleware/auth.js';

export function sessionsRouter(
  db: Database.Database,
  broadcast: (sessionId: string, data: any) => void
) {
  const router = Router();

  router.post('/', requireOrganizer, (req, res) => {
    const { name, listNumbers } = req.body;
    const organizerId = req.user!.id;
    const id = nanoid(8);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    db.prepare(
      'INSERT INTO sessions (id, name, organizer_id, status, expires_at) VALUES (?, ?, ?, ?, ?)'
    ).run(id, name, organizerId, 'setup', expiresAt);

    // Parse list numbers — detect CSV vs plain text
    let lists: { list_number: string; label?: string }[] = [];

    if (listNumbers.includes(',')) {
      // Try CSV parse
      const parsed = Papa.parse(listNumbers, { header: true, skipEmptyLines: true });
      lists = parsed.data.map((row: any) => ({
        list_number: row.list_number || row['List Number'] || Object.values(row)[0] as string,
        label: row.label || row.Label || row.turf || row.Turf || undefined,
      }));
    } else {
      // Plain text, one per line
      lists = listNumbers
        .split('\n')
        .map((n: string) => n.trim())
        .filter(Boolean)
        .map((n: string) => ({ list_number: n }));
    }

    const insertList = db.prepare(
      'INSERT INTO lists (session_id, list_number, label) VALUES (?, ?, ?)'
    );
    for (const list of lists) {
      insertList.run(id, list.list_number, list.label || null);
    }

    const savedLists = db.prepare('SELECT * FROM lists WHERE session_id = ?').all(id);

    res.status(201).json({ id, name, status: 'setup', lists: savedLists });
  });

  router.post('/:id/activate', requireOrganizer, (req, res) => {
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id) as any;
    if (!session) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    if (session.organizer_id !== req.user!.id) {
      res.status(403).json({ error: 'Not your session' });
      return;
    }
    if (session.status !== 'setup') {
      res.status(400).json({ error: 'Session can only be activated from setup status' });
      return;
    }
    db.prepare("UPDATE sessions SET status = 'active' WHERE id = ?").run(req.params.id);
    res.json({ status: 'active' });
  });

  router.get('/:id', (req, res) => {
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
    if (!session) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const lists = db.prepare('SELECT * FROM lists WHERE session_id = ?').all(req.params.id);
    const groups = db.prepare('SELECT * FROM groups WHERE session_id = ?').all(req.params.id);
    const canvassers = db.prepare('SELECT * FROM canvassers WHERE session_id = ?').all(req.params.id);
    const groupLists = db.prepare(
      'SELECT gl.* FROM group_lists gl JOIN groups g ON gl.group_id = g.id WHERE g.session_id = ?'
    ).all(req.params.id);

    res.json({ ...(session as any), lists, groups, canvassers, groupLists });
  });

  router.patch('/:id', requireOrganizer, (req, res) => {
    const { id } = req.params;
    const { signalInviteLink } = req.body;

    if (signalInviteLink !== null && typeof signalInviteLink !== 'string') {
      res.status(400).json({ error: 'signalInviteLink must be a string or null' });
      return;
    }

    if (typeof signalInviteLink === 'string' && !signalInviteLink.startsWith('https://signal.group/#')) {
      res.status(400).json({ error: 'signalInviteLink must start with https://signal.group/#' });
      return;
    }

    const existing = db.prepare('SELECT organizer_id FROM sessions WHERE id = ?').get(id) as
      | { organizer_id: string }
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    if (existing.organizer_id !== req.user!.id) {
      res.status(403).json({ error: 'Not your session' });
      return;
    }

    db.prepare('UPDATE sessions SET signal_invite_link = ? WHERE id = ?').run(signalInviteLink, id);

    broadcast(id, { type: 'signal_link_set', signalInviteLink });

    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
    res.json(session);
  });

  /** List the signed-in organizer's own sessions (for the post-login dashboard). */
  router.get('/', requireOrganizer, (req, res) => {
    const rows = db
      .prepare(
        `SELECT id, name, status, created_at, expires_at, signal_invite_link
         FROM sessions
         WHERE organizer_id = ?
         ORDER BY created_at DESC`,
      )
      .all(req.user!.id);
    res.json({ sessions: rows });
  });

  return router;
}
