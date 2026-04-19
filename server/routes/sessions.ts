import { Router } from 'express';
import Database from 'better-sqlite3';
import { nanoid } from 'nanoid';
import Papa from 'papaparse';

export function sessionsRouter(db: Database.Database) {
  const router = Router();

  router.post('/', (req, res) => {
    const { name, listNumbers, organizerId } = req.body;
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

  router.post('/:id/activate', (req, res) => {
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id) as any;
    if (!session) {
      res.status(404).json({ error: 'Not found' });
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

  return router;
}
