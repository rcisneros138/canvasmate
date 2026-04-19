import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createDatabase } from '../db/index';
import { sessionsRouter } from './sessions';
import { checkinRouter } from './checkin';

describe('POST /api/checkin', () => {
  let app: express.Express;
  let sessionId: string;

  beforeEach(async () => {
    const db = createDatabase(':memory:');
    app = express();
    app.use(express.json());
    app.use('/api/sessions', sessionsRouter(db));
    app.use('/api/checkin', checkinRouter(db));

    const res = await request(app)
      .post('/api/sessions')
      .send({ name: 'Test', listNumbers: '111', organizerId: 'org-1' });
    sessionId = res.body.id;

    // Activate session
    db.prepare("UPDATE sessions SET status = 'active' WHERE id = ?").run(sessionId);
  });

  it('checks in a canvasser with minimal info', async () => {
    const res = await request(app)
      .post('/api/checkin')
      .send({ sessionId, displayName: 'Alice' });

    expect(res.status).toBe(201);
    expect(res.body.sessionToken).toBeDefined();
    expect(res.body.displayName).toBe('Alice');
  });

  it('checks in with optional phone and minivan ID', async () => {
    const res = await request(app)
      .post('/api/checkin')
      .send({ sessionId, displayName: 'Bob', phone: '+15551234567', minivanId: '12345' });

    expect(res.status).toBe(201);
    expect(res.body.displayName).toBe('Bob');
  });

  it('rejects check-in to non-active session', async () => {
    const db2 = createDatabase(':memory:');
    const app2 = express();
    app2.use(express.json());
    app2.use('/api/sessions', sessionsRouter(db2));
    app2.use('/api/checkin', checkinRouter(db2));

    const s = await request(app2)
      .post('/api/sessions')
      .send({ name: 'X', listNumbers: '111', organizerId: 'org-1' });

    const res = await request(app2)
      .post('/api/checkin')
      .send({ sessionId: s.body.id, displayName: 'Eve' });

    expect(res.status).toBe(400);
  });
});
