import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createDatabase } from '../db/index';
import { sessionsRouter } from './sessions';
import { checkinRouter } from './checkin';
import { assignmentsRouter } from './assignments';

describe('assignments', () => {
  let app: express.Express;
  let db: ReturnType<typeof createDatabase>;
  let sessionId: string;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    app = express();
    app.use(express.json());
    app.use('/api/sessions', sessionsRouter(db));
    app.use('/api/checkin', checkinRouter(db));
    app.use('/api/assignments', assignmentsRouter(db, () => {}));

    const s = await request(app)
      .post('/api/sessions')
      .send({ name: 'Test', listNumbers: '111\n222', organizerId: 'org-1' });
    sessionId = s.body.id;
    db.prepare("UPDATE sessions SET status = 'active' WHERE id = ?").run(sessionId);

    await request(app).post('/api/checkin').send({ sessionId, displayName: 'Alice' });
    await request(app).post('/api/checkin').send({ sessionId, displayName: 'Bob' });
  });

  it('creates a group and assigns canvassers', async () => {
    const canvassers = db.prepare('SELECT id FROM canvassers WHERE session_id = ?').all(sessionId) as any[];

    const res = await request(app)
      .post('/api/assignments/groups')
      .send({
        sessionId,
        name: 'Team A',
        listIds: [1],
        canvasserIds: [canvassers[0].id, canvassers[1].id],
      });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Team A');

    // Verify canvassers are assigned
    const updated = db.prepare('SELECT group_id FROM canvassers WHERE session_id = ?').all(sessionId) as any[];
    expect(updated.every((c: any) => c.group_id === res.body.id)).toBe(true);
  });

  it('assigns a solo canvasser directly to a list', async () => {
    const canvassers = db.prepare('SELECT id FROM canvassers WHERE session_id = ?').all(sessionId) as any[];

    const res = await request(app)
      .post('/api/assignments/solo')
      .send({
        sessionId,
        canvasserId: canvassers[0].id,
        listId: 1,
      });

    expect(res.status).toBe(200);
  });
});

describe('POST /api/assignments/groups/:id/lead', () => {
  let app: express.Express;
  let db: ReturnType<typeof createDatabase>;
  let broadcastMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    db = createDatabase(':memory:');
    broadcastMock = vi.fn();
    app = express();
    app.use(express.json());
    app.use('/api/assignments', assignmentsRouter(db, broadcastMock));
  });

  it('sets the group lead and broadcasts', async () => {
    // Seed: session, group, canvasser belonging to that group
    db.prepare("INSERT INTO sessions (id, name, organizer_id, status, expires_at) VALUES ('s1','S','o1','active',datetime('now','+1 day'))").run();
    const groupId = (db.prepare("INSERT INTO groups (session_id, name) VALUES ('s1','A')").run() as any).lastInsertRowid;
    const canvasserId = (db.prepare("INSERT INTO canvassers (session_id, display_name, group_id, session_token) VALUES ('s1','Alice',?,?)").run(groupId, 'tok')).lastInsertRowid;

    const res = await request(app)
      .post(`/api/assignments/groups/${groupId}/lead`)
      .send({ sessionId: 's1', canvasserId });

    expect(res.status).toBe(200);
    const stored = db.prepare('SELECT group_lead_canvasser_id FROM groups WHERE id = ?').get(groupId) as any;
    expect(stored.group_lead_canvasser_id).toBe(canvasserId);
    expect(broadcastMock).toHaveBeenCalledWith('s1', expect.objectContaining({ type: 'group_lead_set', groupId, canvasserId }));
  });

  it('rejects if canvasser is not in the group', async () => {
    db.prepare("INSERT INTO sessions (id, name, organizer_id, status, expires_at) VALUES ('s1','S','o1','active',datetime('now','+1 day'))").run();
    const groupId = (db.prepare("INSERT INTO groups (session_id, name) VALUES ('s1','A')").run() as any).lastInsertRowid;
    const otherId = (db.prepare("INSERT INTO canvassers (session_id, display_name, session_token) VALUES ('s1','Bob','tok2')").run()).lastInsertRowid;

    const res = await request(app)
      .post(`/api/assignments/groups/${groupId}/lead`)
      .send({ sessionId: 's1', canvasserId: otherId });

    expect(res.status).toBe(400);
    expect(broadcastMock).not.toHaveBeenCalled();
    const stored = db.prepare('SELECT group_lead_canvasser_id FROM groups WHERE id = ?').get(groupId) as any;
    expect(stored.group_lead_canvasser_id).toBeNull();
  });

  it('returns 404 when group does not exist in session', async () => {
    db.prepare("INSERT INTO sessions (id, name, organizer_id, status, expires_at) VALUES ('s1','S','o1','active',datetime('now','+1 day'))").run();
    db.prepare("INSERT INTO sessions (id, name, organizer_id, status, expires_at) VALUES ('s2','S2','o1','active',datetime('now','+1 day'))").run();
    // Group belongs to s2, but request claims sessionId s1
    const groupId = (db.prepare("INSERT INTO groups (session_id, name) VALUES ('s2','A')").run() as any).lastInsertRowid;
    // Canvasser in s1 with matching group_id (simulates a numeric collision)
    const canvasserId = (db.prepare("INSERT INTO canvassers (session_id, display_name, group_id, session_token) VALUES ('s1','Alice',?,?)").run(groupId, 'tok')).lastInsertRowid;

    const res = await request(app)
      .post(`/api/assignments/groups/${groupId}/lead`)
      .send({ sessionId: 's1', canvasserId });

    expect(res.status).toBe(404);
    expect(broadcastMock).not.toHaveBeenCalled();
  });
});
