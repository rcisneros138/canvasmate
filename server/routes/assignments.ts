import { Router } from 'express';
import Database from 'better-sqlite3';

export function assignmentsRouter(db: Database.Database, broadcast: (sessionId: string, data: any) => void) {
  const router = Router();

  router.post('/groups', (req, res) => {
    const { sessionId, name, listIds, canvasserIds } = req.body;

    const result = db.prepare(
      'INSERT INTO groups (session_id, name) VALUES (?, ?)'
    ).run(sessionId, name);

    const groupId = result.lastInsertRowid;

    const insertGroupList = db.prepare('INSERT INTO group_lists (group_id, list_id) VALUES (?, ?)');
    for (const listId of listIds) {
      insertGroupList.run(groupId, listId);
    }

    const updateCanvasser = db.prepare('UPDATE canvassers SET group_id = ? WHERE id = ?');
    for (const cid of canvasserIds) {
      updateCanvasser.run(groupId, cid);
    }

    broadcast(sessionId, {
      type: 'group_created',
      group: { id: groupId, name, listIds, canvasserIds },
    });

    res.status(201).json({ id: groupId, name, listIds, canvasserIds });
  });

  router.post('/solo', (req, res) => {
    const { sessionId, canvasserId, listId } = req.body;

    // Create a solo group
    const result = db.prepare(
      'INSERT INTO groups (session_id, name) VALUES (?, ?)'
    ).run(sessionId, `Solo`);

    const groupId = result.lastInsertRowid;
    db.prepare('INSERT INTO group_lists (group_id, list_id) VALUES (?, ?)').run(groupId, listId);
    db.prepare('UPDATE canvassers SET group_id = ? WHERE id = ?').run(groupId, canvasserId);

    broadcast(sessionId, {
      type: 'solo_assigned',
      canvasserId,
      listId,
      groupId,
    });

    res.status(200).json({ groupId, canvasserId, listId });
  });

  router.post('/unassign', (req, res) => {
    const { sessionId, canvasserId } = req.body;

    db.prepare('UPDATE canvassers SET group_id = NULL WHERE id = ? AND session_id = ?').run(canvasserId, sessionId);

    broadcast(sessionId, {
      type: 'canvasser_unassigned',
      canvasserId,
    });

    res.json({ canvasserId, groupId: null });
  });

  router.post('/groups/:id/lead', (req, res) => {
    const groupId = Number(req.params.id);
    const { sessionId, canvasserId } = req.body;

    const canvasser = db.prepare(
      'SELECT group_id FROM canvassers WHERE id = ? AND session_id = ?'
    ).get(canvasserId, sessionId) as any;

    if (!canvasser || canvasser.group_id !== groupId) {
      res.status(400).json({ error: 'Canvasser is not in this group' });
      return;
    }

    const result = db.prepare(
      'UPDATE groups SET group_lead_canvasser_id = ? WHERE id = ? AND session_id = ?'
    ).run(canvasserId, groupId, sessionId);

    if (result.changes === 0) {
      res.status(404).json({ error: 'Group not found in this session' });
      return;
    }

    broadcast(sessionId, { type: 'group_lead_set', groupId, canvasserId });
    res.json({ groupId, canvasserId });
  });

  return router;
}
