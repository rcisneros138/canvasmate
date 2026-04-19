import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createDatabase } from '../db/index';
import { authRouter } from './auth';

describe('auth', () => {
  let app: express.Express;

  beforeEach(() => {
    const db = createDatabase(':memory:');
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRouter(db));
  });

  it('registers a new organizer', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'org@example.com', password: 'securepass123' });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
  });

  it('logs in an existing organizer', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'org@example.com', password: 'securepass123' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'org@example.com', password: 'securepass123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('rejects wrong password', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'org@example.com', password: 'securepass123' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'org@example.com', password: 'wrong' });

    expect(res.status).toBe(401);
  });
});
