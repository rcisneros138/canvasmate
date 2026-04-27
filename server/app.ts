import express from 'express';
import { createServer } from 'http';
import Database from 'better-sqlite3';
import type { WebSocketServer } from 'ws';
import { createDatabase } from './db/index';
import { sessionsRouter } from './routes/sessions';
import { checkinRouter } from './routes/checkin';
import { assignmentsRouter } from './routes/assignments';
import { authRouter } from './routes/auth';
import { SignalService } from './services/signal';
import { signalSetupRouter } from './routes/signal-setup';
import { lockRouter } from './routes/lock';
import { setupWebSocket } from './ws/index';

export interface AppContext {
  app: express.Express;
  server: ReturnType<typeof createServer>;
  db: Database.Database;
  signal: SignalService;
  broadcast: (sessionId: string, data: any) => void;
  wss: WebSocketServer;
}

export function buildApp(opts: { dbPath: string; signalApiUrl: string }): AppContext {
  const app = express();
  const server = createServer(app);
  const db = createDatabase(opts.dbPath);
  const { broadcast, wss } = setupWebSocket(server);
  const signal = new SignalService(opts.signalApiUrl);

  app.use(express.json());
  app.use('/api/sessions', sessionsRouter(db));
  app.use('/api/checkin', checkinRouter(db));
  app.use('/api/assignments', assignmentsRouter(db, broadcast));
  app.use('/api/auth', authRouter(db));
  app.use('/api/signal', signalSetupRouter(db, signal));
  app.use('/api/sessions', lockRouter(db, signal, broadcast));
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  return { app, server, db, signal, broadcast, wss };
}
