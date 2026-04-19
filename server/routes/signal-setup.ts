import { Router } from 'express';
import Database from 'better-sqlite3';
import { SignalService } from '../services/signal';

export function signalSetupRouter(db: Database.Database, signal: SignalService) {
  const router = Router();

  router.get('/status', (_req, res) => {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'signal_number'").get() as any;
    if (row) {
      res.json({ status: 'configured', number: row.value });
    } else {
      res.json({ status: 'not_configured' });
    }
  });

  router.post('/register', async (req, res) => {
    const { number } = req.body;
    const result = await signal.register(number);
    if (!result.ok) {
      res.status(502).json({ error: result.error || 'Signal registration failed' });
      return;
    }
    res.json({ status: 'verification_sent' });
  });

  router.post('/verify', async (req, res) => {
    const { number, code } = req.body;
    const result = await signal.verify(number, code);
    if (!result.ok) {
      res.status(400).json({ error: result.error || 'Verification failed' });
      return;
    }

    db.prepare(
      "INSERT OR REPLACE INTO settings (key, value) VALUES ('signal_number', ?)"
    ).run(number);

    res.json({ status: 'configured', number });
  });

  return router;
}
