import { describe, it, expect, beforeEach } from 'vitest';
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
