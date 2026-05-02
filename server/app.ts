import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { existsSync } from 'fs';
import Database from 'better-sqlite3';
import type { WebSocketServer } from 'ws';
import { createDatabase } from './db/index.js';
import { sessionsRouter } from './routes/sessions.js';
import { checkinRouter } from './routes/checkin.js';
import { assignmentsRouter } from './routes/assignments.js';
import { authRouter } from './routes/auth.js';
import { lockRouter } from './routes/lock.js';
import { setupWebSocket } from './ws/index.js';

export interface AppContext {
  app: express.Express;
  server: ReturnType<typeof createServer>;
  db: Database.Database;
  broadcast: (sessionId: string, data: any) => void;
  wss: WebSocketServer;
}

export function buildApp(opts: { dbPath: string; signalApiUrl: string }): AppContext {
  const app = express();
  const server = createServer(app);
  const db = createDatabase(opts.dbPath);
  const { broadcast, wss } = setupWebSocket(server);

  app.use(express.json());
  app.use('/api/sessions', sessionsRouter(db, broadcast));
  app.use('/api/checkin', checkinRouter(db));
  app.use('/api/assignments', assignmentsRouter(db, broadcast));
  app.use('/api/auth', authRouter(db));
  app.use('/api/sessions', lockRouter(db, broadcast));
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Serve the built client bundle in production. Skipped in tests / dev where
  // client/dist isn't present (Vite serves the client during dev).
  const clientDist = path.resolve(process.cwd(), 'client/dist');
  if (existsSync(clientDist)) {
    app.use(express.static(clientDist));
    // SPA fallback: serve index.html for any non-API GET request that didn't
    // match a static asset above. We use a path-less middleware (rather than
    // app.get('*', ...)) because Express 5 / path-to-regexp v8 no longer
    // accepts the bare '*' route pattern.
    app.use((req, res, next) => {
      if (req.method !== 'GET') return next();
      if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
        return next();
      }
      res.status(200).sendFile(path.join(clientDist, 'index.html'));
    });
  }

  return { app, server, db, broadcast, wss };
}
