import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createDatabase } from '../db/index';
import { signalSetupRouter } from './signal-setup';
import { SignalService } from '../services/signal';

describe('signal setup', () => {
  let app: express.Express;
  let db: ReturnType<typeof createDatabase>;
  let mockFetch: ReturnType<typeof vi.fn>;
  let signal: SignalService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    mockFetch = vi.fn();
    signal = new SignalService('http://localhost:8080', mockFetch as any);
    app = express();
    app.use(express.json());
    app.use('/api/signal', signalSetupRouter(db, signal));
  });

  describe('GET /api/signal/status', () => {
    it('returns not_configured when no number is saved', async () => {
      const res = await request(app).get('/api/signal/status');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('not_configured');
    });

    it('returns configured when a number is saved', async () => {
      db.prepare("INSERT INTO settings (key, value) VALUES ('signal_number', '+15551234567')").run();
      const res = await request(app).get('/api/signal/status');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('configured');
      expect(res.body.number).toBe('+15551234567');
    });
  });

  describe('POST /api/signal/register', () => {
    it('sends registration request to signal-cli API', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

      const res = await request(app)
        .post('/api/signal/register')
        .send({ number: '+15551234567' });

      expect(res.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/v1/register/+15551234567',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('returns error when signal-cli API fails', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500, text: () => Promise.resolve('error') });

      const res = await request(app)
        .post('/api/signal/register')
        .send({ number: '+15551234567' });

      expect(res.status).toBe(502);
    });
  });

  describe('POST /api/signal/verify', () => {
    it('verifies code and saves number to settings', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

      const res = await request(app)
        .post('/api/signal/verify')
        .send({ number: '+15551234567', code: '123-456' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('configured');

      const saved = db.prepare("SELECT value FROM settings WHERE key = 'signal_number'").get() as any;
      expect(saved.value).toBe('+15551234567');
    });

    it('does not save number when verification fails', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 403, text: () => Promise.resolve('bad code') });

      const res = await request(app)
        .post('/api/signal/verify')
        .send({ number: '+15551234567', code: '000-000' });

      expect(res.status).toBe(400);

      const saved = db.prepare("SELECT value FROM settings WHERE key = 'signal_number'").get();
      expect(saved).toBeUndefined();
    });
  });
});
