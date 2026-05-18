import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createDatabase } from '../db/index';
import { sessionsRouter } from './sessions';
import { readAuth } from '../middleware/auth';
import { seedAuthedUser } from '../test-helpers/auth';

function buildTestApp() {
  const db = createDatabase(':memory:');
  const broadcastMock = vi.fn();
  const app = express();
  app.use(express.json());
  app.use(readAuth(db));
  app.use('/api/sessions', sessionsRouter(db, broadcastMock));
  const auth = seedAuthedUser(db);
  return { app, db, broadcastMock, auth };
}

describe('POST /api/sessions', () => {
  let app: express.Express;
  let cookie: string;

  beforeEach(() => {
    const built = buildTestApp();
    app = built.app;
    cookie = built.auth.cookie;
  });

  it('creates a session with list numbers from plain text', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .set('Cookie', cookie)
      .send({
        name: 'Saturday Canvass',
        listNumbers: '4821093\n4821094\n4821095',
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe('Saturday Canvass');
    expect(res.body.lists).toHaveLength(3);
    expect(res.body.lists[0].list_number).toBe('4821093');
  });

  it('creates a session with list numbers from CSV', async () => {
    const csv = 'list_number,label\n4821093,Elm St\n4821094,Oak Ave';
    const res = await request(app)
      .post('/api/sessions')
      .set('Cookie', cookie)
      .send({
        name: 'Sunday Canvass',
        listNumbers: csv,
      });

    expect(res.status).toBe(201);
    expect(res.body.lists).toHaveLength(2);
    expect(res.body.lists[0].label).toBe('Elm St');
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .send({ name: 'No auth', listNumbers: '111' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/sessions/:id', () => {
  let app: express.Express;
  let cookie: string;
  let sessionId: string;

  beforeEach(async () => {
    const built = buildTestApp();
    app = built.app;
    cookie = built.auth.cookie;

    const res = await request(app)
      .post('/api/sessions')
      .set('Cookie', cookie)
      .send({ name: 'Test', listNumbers: '111\n222' });
    sessionId = res.body.id;
  });

  it('returns session with lists, groups, and canvassers (no auth needed)', async () => {
    const res = await request(app).get(`/api/sessions/${sessionId}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Test');
    expect(res.body.lists).toHaveLength(2);
    expect(res.body.groups).toEqual([]);
    expect(res.body.canvassers).toEqual([]);
  });

  it('returns 404 for a nonexistent session', async () => {
    const res = await request(app).get('/api/sessions/nonexistent-id');
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/sessions/:id', () => {
  let app: express.Express;
  let db: ReturnType<typeof createDatabase>;
  let cookie: string;
  let sessionId: string;
  let broadcastMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const built = buildTestApp();
    app = built.app;
    db = built.db;
    cookie = built.auth.cookie;
    broadcastMock = built.broadcastMock;

    const s = await request(app)
      .post('/api/sessions')
      .set('Cookie', cookie)
      .send({ name: 'Test', listNumbers: '111\n222' });
    sessionId = s.body.id;
    broadcastMock.mockClear();
  });

  it('sets signal_invite_link and broadcasts', async () => {
    const res = await request(app)
      .patch(`/api/sessions/${sessionId}`)
      .set('Cookie', cookie)
      .send({ signalInviteLink: 'https://signal.group/#abc123' });

    expect(res.status).toBe(200);
    expect(res.body.signal_invite_link).toBe('https://signal.group/#abc123');
    expect(broadcastMock).toHaveBeenCalledWith(sessionId, {
      type: 'signal_link_set',
      signalInviteLink: 'https://signal.group/#abc123',
    });

    const stored = db
      .prepare('SELECT signal_invite_link FROM sessions WHERE id = ?')
      .get(sessionId) as any;
    expect(stored.signal_invite_link).toBe('https://signal.group/#abc123');
  });

  it('clears the link when given null', async () => {
    db.prepare("UPDATE sessions SET signal_invite_link = 'old' WHERE id = ?").run(sessionId);
    const res = await request(app)
      .patch(`/api/sessions/${sessionId}`)
      .set('Cookie', cookie)
      .send({ signalInviteLink: null });

    expect(res.status).toBe(200);
    expect(res.body.signal_invite_link).toBeNull();
    expect(broadcastMock).toHaveBeenCalledWith(sessionId, {
      type: 'signal_link_set',
      signalInviteLink: null,
    });
  });

  it('rejects malformed links with 400', async () => {
    const res = await request(app)
      .patch(`/api/sessions/${sessionId}`)
      .set('Cookie', cookie)
      .send({ signalInviteLink: 'http://evil.example.com/#x' });

    expect(res.status).toBe(400);
    expect(broadcastMock).not.toHaveBeenCalled();
  });

  it('returns 404 for unknown session', async () => {
    const res = await request(app)
      .patch('/api/sessions/does-not-exist')
      .set('Cookie', cookie)
      .send({ signalInviteLink: 'https://signal.group/#x' });

    expect(res.status).toBe(404);
  });

  it('rejects PATCH from a different organizer with 403', async () => {
    const other = seedAuthedUser(db, 'other@example.com');
    const res = await request(app)
      .patch(`/api/sessions/${sessionId}`)
      .set('Cookie', other.cookie)
      .send({ signalInviteLink: 'https://signal.group/#x' });
    expect(res.status).toBe(403);
  });
});
