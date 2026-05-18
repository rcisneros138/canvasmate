import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createDatabase } from '../db/index';
import { sessionsRouter } from './sessions';
import { checkinRouter } from './checkin';
import { readAuth } from '../middleware/auth';
import { seedAuthedUser } from '../test-helpers/auth';

function buildTestApp() {
  const db = createDatabase(':memory:');
  const app = express();
  app.use(express.json());
  app.use(readAuth(db));
  app.use('/api/sessions', sessionsRouter(db, () => {}));
  app.use('/api/checkin', checkinRouter(db));
  const auth = seedAuthedUser(db);
  return { app, db, auth };
}

describe('POST /api/checkin', () => {
  let app: express.Express;
  let db: ReturnType<typeof createDatabase>;
  let cookie: string;
  let sessionId: string;

  beforeEach(async () => {
    const built = buildTestApp();
    app = built.app;
    db = built.db;
    cookie = built.auth.cookie;

    const res = await request(app)
      .post('/api/sessions')
      .set('Cookie', cookie)
      .send({ name: 'Test', listNumbers: '111' });
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
    const built2 = buildTestApp();
    const s = await request(built2.app)
      .post('/api/sessions')
      .set('Cookie', built2.auth.cookie)
      .send({ name: 'X', listNumbers: '111' });

    const res = await request(built2.app)
      .post('/api/checkin')
      .send({ sessionId: s.body.id, displayName: 'Eve' });

    expect(res.status).toBe(400);
  });
});
