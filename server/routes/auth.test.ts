import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createDatabase } from '../db/index';
import { authRouter } from './auth';
import { readAuth } from '../middleware/auth';
import type { Mailer } from '../services/mailer';
import type { TurnstileVerifier } from '../services/turnstile';

class CapturingMailer implements Mailer {
  sent: { to: string; link: string }[] = [];
  async sendMagicLink(args: { to: string; link: string }) {
    this.sent.push(args);
  }
}

class StubTurnstile implements TurnstileVerifier {
  constructor(public enabled: boolean = false, public ok: boolean = true) {}
  async verify() {
    return this.ok;
  }
}

interface TestAppOpts {
  turnstile?: TurnstileVerifier;
}

function buildTestApp(opts: TestAppOpts = {}) {
  const db = createDatabase(':memory:');
  const mailer = new CapturingMailer();
  const turnstile = opts.turnstile ?? new StubTurnstile();
  const app = express();
  app.use(express.json());
  app.use(readAuth(db));
  app.use(
    '/api/auth',
    authRouter({ db, mailer, turnstile, appUrl: 'http://test', cookieSecure: false }),
  );
  return { app, db, mailer, turnstile };
}

function tokenFromLink(link: string): string {
  const u = new URL(link);
  return u.searchParams.get('token')!;
}

function authCookieFromHeaders(headers: any): string | undefined {
  const cookies = headers['set-cookie'] as string[] | undefined;
  if (!cookies) return undefined;
  const c = cookies.find((c) => c.startsWith('cm_auth='));
  return c?.split(';')[0]; // "cm_auth=<token>"
}

describe('auth: magic link', () => {
  let mailer: CapturingMailer;
  let app: express.Express;
  let db: ReturnType<typeof createDatabase>;

  beforeEach(() => {
    const built = buildTestApp();
    app = built.app;
    db = built.db;
    mailer = built.mailer;
  });

  it('sends a magic link on /request', async () => {
    const res = await request(app)
      .post('/api/auth/request')
      .send({ email: 'lead@example.com' });

    expect(res.status).toBe(202);
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0].to).toBe('lead@example.com');
    expect(mailer.sent[0].link).toContain('http://test/api/auth/verify?token=');
  });

  it('rejects invalid email', async () => {
    const res = await request(app)
      .post('/api/auth/request')
      .send({ email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(mailer.sent).toHaveLength(0);
  });

  it('normalises email to lowercase + trim', async () => {
    await request(app)
      .post('/api/auth/request')
      .send({ email: '  LEAD@Example.COM  ' });
    expect(mailer.sent[0].to).toBe('lead@example.com');
  });

  it('verify creates a user, sets cookie, and 302s to next', async () => {
    await request(app)
      .post('/api/auth/request')
      .send({ email: 'lead@example.com', next: '/session/new' });
    const u = new URL(mailer.sent[0].link);

    const res = await request(app).get(`/api/auth/verify${u.search}`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/session/new');
    expect(authCookieFromHeaders(res.headers)).toBeDefined();

    const user = db.prepare('SELECT email FROM users').get() as any;
    expect(user.email).toBe('lead@example.com');
  });

  it('verify is one-shot — second use is rejected', async () => {
    await request(app).post('/api/auth/request').send({ email: 'lead@example.com' });
    const token = tokenFromLink(mailer.sent[0].link);

    await request(app).get(`/api/auth/verify?token=${token}`);
    const res = await request(app).get(`/api/auth/verify?token=${token}`);
    expect(res.status).toBe(400);
  });

  it('verify rejects unknown token', async () => {
    const res = await request(app).get('/api/auth/verify?token=nope');
    expect(res.status).toBe(400);
  });

  it('verify with malicious next falls back to /', async () => {
    await request(app)
      .post('/api/auth/request')
      .send({ email: 'lead@example.com', next: '//evil.com' });
    const u = new URL(mailer.sent[0].link);

    const res = await request(app).get(`/api/auth/verify${u.search}`);
    expect(res.headers.location).toBe('/');
  });

  it('/me returns null when unauthenticated', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.user).toBeNull();
  });

  it('/me returns user when cookie is valid', async () => {
    await request(app).post('/api/auth/request').send({ email: 'lead@example.com' });
    const token = tokenFromLink(mailer.sent[0].link);
    const verifyRes = await request(app).get(`/api/auth/verify?token=${token}`);
    const cookie = authCookieFromHeaders(verifyRes.headers)!;

    const me = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('lead@example.com');
  });

  it('logout clears the cookie and invalidates the session', async () => {
    await request(app).post('/api/auth/request').send({ email: 'lead@example.com' });
    const token = tokenFromLink(mailer.sent[0].link);
    const verifyRes = await request(app).get(`/api/auth/verify?token=${token}`);
    const cookie = authCookieFromHeaders(verifyRes.headers)!;

    await request(app).post('/api/auth/logout').set('Cookie', cookie);

    const me = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(me.body.user).toBeNull();
  });

  it('rejects /request when turnstile is enabled and token is missing', async () => {
    const built = buildTestApp({ turnstile: new StubTurnstile(true, false) });
    const res = await request(built.app)
      .post('/api/auth/request')
      .send({ email: 'lead@example.com' });
    expect(res.status).toBe(400);
    expect(built.mailer.sent).toHaveLength(0);
  });

  it('accepts /request when turnstile is enabled and token verifies', async () => {
    const built = buildTestApp({ turnstile: new StubTurnstile(true, true) });
    const res = await request(built.app)
      .post('/api/auth/request')
      .send({ email: 'lead@example.com', turnstile: 'cf-token' });
    expect(res.status).toBe(202);
    expect(built.mailer.sent).toHaveLength(1);
  });

  it('rate-limits /request after 5 hits per IP per hour', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post('/api/auth/request')
        .send({ email: 'lead@example.com' });
      expect(res.status).toBe(202);
    }
    const blocked = await request(app)
      .post('/api/auth/request')
      .send({ email: 'lead@example.com' });
    expect(blocked.status).toBe(429);
    expect(blocked.headers['retry-after']).toBeDefined();
  });

  it('re-uses an existing user on second login (no duplicate row)', async () => {
    await request(app).post('/api/auth/request').send({ email: 'lead@example.com' });
    let token = tokenFromLink(mailer.sent[0].link);
    await request(app).get(`/api/auth/verify?token=${token}`);

    await request(app).post('/api/auth/request').send({ email: 'lead@example.com' });
    token = tokenFromLink(mailer.sent[1].link);
    await request(app).get(`/api/auth/verify?token=${token}`);

    const count = db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number };
    expect(count.n).toBe(1);
  });
});
