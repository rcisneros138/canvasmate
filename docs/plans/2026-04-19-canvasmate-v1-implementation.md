# CanvasMate v1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a self-hostable PWA that lets political canvass organizers create sessions, check in canvassers via QR code, assign MiniVAN list numbers via drag-and-drop on a projected screen, and auto-create Signal groups.

**Architecture:** Monorepo with a Vite React frontend and Express backend sharing a single `package.json` workspace. WebSockets push real-time assignment updates. SQLite stores ephemeral session data. A Signal REST API sidecar handles group creation.

**Tech Stack:** Node.js, Express, ws, better-sqlite3, umzug, React, TypeScript, Tailwind CSS, @dnd-kit, qrcode.react, papaparse, vite-plugin-pwa, Docker, bbernhard/signal-cli-rest-api

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `server/index.ts`
- Create: `server/tsconfig.json`
- Create: `client/index.html`
- Create: `client/src/main.tsx`
- Create: `client/src/App.tsx`
- Create: `client/vite.config.ts`
- Create: `client/tsconfig.json`
- Create: `client/tailwind.config.ts`
- Create: `client/postcss.config.js`
- Create: `.gitignore`
- Create: `Dockerfile`
- Create: `docker-compose.yml`

**Step 1: Initialize workspace package.json**

```json
{
  "name": "canvasmate",
  "private": true,
  "workspaces": ["client", "server"],
  "scripts": {
    "dev": "concurrently \"npm run dev:server\" \"npm run dev:client\"",
    "dev:server": "npm run dev --workspace=server",
    "dev:client": "npm run dev --workspace=client",
    "build": "npm run build --workspace=client && npm run build --workspace=server",
    "start": "npm run start --workspace=server"
  },
  "devDependencies": {
    "concurrently": "^9.0.0",
    "typescript": "^5.5.0"
  }
}
```

**Step 2: Create server package**

`server/package.json`:
```json
{
  "name": "canvasmate-server",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "express": "^5.0.0",
    "ws": "^8.18.0",
    "better-sqlite3": "^11.0.0",
    "umzug": "^3.8.0",
    "papaparse": "^5.4.0",
    "nanoid": "^5.0.0",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "@types/express": "^5.0.0",
    "@types/ws": "^8.5.0",
    "@types/better-sqlite3": "^7.6.0",
    "@types/papaparse": "^5.3.0",
    "@types/cors": "^2.8.0",
    "vitest": "^2.1.0"
  }
}
```

`server/index.ts` (minimal hello world):
```typescript
import express from 'express';
import { createServer } from 'http';

const app = express();
const server = createServer(app);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`CanvasMate server running on port ${PORT}`);
});
```

**Step 3: Create client package**

`client/package.json`:
```json
{
  "name": "canvasmate-client",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@dnd-kit/core": "^6.1.0",
    "@dnd-kit/sortable": "^8.0.0",
    "qrcode.react": "^4.1.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.0",
    "vite": "^6.0.0",
    "vite-plugin-pwa": "^0.21.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/vite": "^4.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.5.0",
    "vitest": "^2.1.0",
    "@testing-library/react": "^16.0.0"
  }
}
```

`client/vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'CanvasMate',
        short_name: 'CanvasMate',
        theme_color: '#1e40af',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/ws': { target: 'ws://localhost:3000', ws: true },
    },
  },
});
```

`client/src/main.tsx`:
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

`client/src/App.tsx`:
```tsx
export default function App() {
  return <div className="min-h-screen bg-gray-50 p-4">
    <h1 className="text-2xl font-bold">CanvasMate</h1>
  </div>;
}
```

`client/src/index.css`:
```css
@import "tailwindcss";
```

`client/index.html`:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CanvasMate</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

**Step 4: Create .gitignore**

```
node_modules/
dist/
data/
*.db
.env
```

**Step 5: Create Docker files**

`Dockerfile`:
```dockerfile
FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/package.json ./server/
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/package.json ./
RUN npm ci --workspace=server --omit=dev
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["node", "server/dist/index.js"]
```

`docker-compose.yml`:
```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - canvasmate-data:/app/data
    environment:
      - SIGNAL_API_URL=http://signal:8080
    depends_on:
      - signal

  signal:
    image: bbernhard/signal-cli-rest-api:latest
    ports:
      - "8080:8080"
    volumes:
      - signal-data:/home/.local/share/signal-cli
    environment:
      - MODE=json-rpc

volumes:
  canvasmate-data:
  signal-data:
```

**Step 6: Install dependencies and verify**

Run: `npm install`
Run: `npm run dev:server` — verify "CanvasMate server running on port 3000"
Run: `curl http://localhost:3000/api/health` — expect `{"status":"ok"}`

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: project scaffolding with monorepo structure"
```

---

## Task 2: Database Schema & Migrations

**Files:**
- Create: `server/db/index.ts`
- Create: `server/db/migrations/001-initial-schema.sql`
- Test: `server/db/index.test.ts`

**Step 1: Write the failing test**

`server/db/index.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase } from './index';

describe('database', () => {
  let db: ReturnType<typeof createDatabase>;

  beforeEach(() => {
    db = createDatabase(':memory:');
  });

  it('creates sessions table', () => {
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'"
    ).all();
    expect(tables).toHaveLength(1);
  });

  it('creates lists table', () => {
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='lists'"
    ).all();
    expect(tables).toHaveLength(1);
  });

  it('creates groups table', () => {
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='groups'"
    ).all();
    expect(tables).toHaveLength(1);
  });

  it('creates canvassers table', () => {
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='canvassers'"
    ).all();
    expect(tables).toHaveLength(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run db/index.test.ts`
Expected: FAIL — `createDatabase` not found

**Step 3: Write the migration**

`server/db/migrations/001-initial-schema.sql`:
```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  organizer_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'setup',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE TABLE lists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  list_number TEXT NOT NULL,
  label TEXT
);

CREATE TABLE groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  signal_group_link TEXT
);

CREATE TABLE group_lists (
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  list_id INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, list_id)
);

CREATE TABLE canvassers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  phone TEXT,
  minivan_id TEXT,
  group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
  session_token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE organizers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Step 4: Write the database module**

`server/db/index.ts`:
```typescript
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createDatabase(path: string) {
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Run migrations
  db.exec(`CREATE TABLE IF NOT EXISTS migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  const applied = new Set(
    db.prepare('SELECT name FROM migrations').all().map((r: any) => r.name)
  );

  const migrationFile = '001-initial-schema.sql';
  if (!applied.has(migrationFile)) {
    const sql = readFileSync(join(__dirname, 'migrations', migrationFile), 'utf-8');
    db.exec(sql);
    db.prepare('INSERT INTO migrations (name) VALUES (?)').run(migrationFile);
  }

  return db;
}
```

**Step 5: Run test to verify it passes**

Run: `cd server && npx vitest run db/index.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add server/db/
git commit -m "feat: database schema with sessions, lists, groups, canvassers"
```

---

## Task 3: Session CRUD API

**Files:**
- Create: `server/routes/sessions.ts`
- Create: `server/routes/sessions.test.ts`
- Modify: `server/index.ts`

**Step 1: Write the failing test**

`server/routes/sessions.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createDatabase } from '../db/index';
import { sessionsRouter } from './sessions';

describe('POST /api/sessions', () => {
  let app: express.Express;

  beforeEach(() => {
    const db = createDatabase(':memory:');
    app = express();
    app.use(express.json());
    app.use('/api/sessions', sessionsRouter(db));
  });

  it('creates a session with list numbers from plain text', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .send({
        name: 'Saturday Canvass',
        listNumbers: '4821093\n4821094\n4821095',
        organizerId: 'org-1',
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
      .send({
        name: 'Sunday Canvass',
        listNumbers: csv,
        organizerId: 'org-1',
      });

    expect(res.status).toBe(201);
    expect(res.body.lists).toHaveLength(2);
    expect(res.body.lists[0].label).toBe('Elm St');
  });
});

describe('GET /api/sessions/:id', () => {
  let app: express.Express;
  let sessionId: string;

  beforeEach(async () => {
    const db = createDatabase(':memory:');
    app = express();
    app.use(express.json());
    app.use('/api/sessions', sessionsRouter(db));

    const res = await request(app)
      .post('/api/sessions')
      .send({ name: 'Test', listNumbers: '111\n222', organizerId: 'org-1' });
    sessionId = res.body.id;
  });

  it('returns session with lists, groups, and canvassers', async () => {
    const res = await request(app).get(`/api/sessions/${sessionId}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Test');
    expect(res.body.lists).toHaveLength(2);
    expect(res.body.groups).toEqual([]);
    expect(res.body.canvassers).toEqual([]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run routes/sessions.test.ts`
Expected: FAIL — module not found

**Step 3: Implement sessions router**

`server/routes/sessions.ts`:
```typescript
import { Router } from 'express';
import Database from 'better-sqlite3';
import { nanoid } from 'nanoid';
import Papa from 'papaparse';

export function sessionsRouter(db: Database.Database) {
  const router = Router();

  router.post('/', (req, res) => {
    const { name, listNumbers, organizerId } = req.body;
    const id = nanoid(8);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    db.prepare(
      'INSERT INTO sessions (id, name, organizer_id, status, expires_at) VALUES (?, ?, ?, ?, ?)'
    ).run(id, name, organizerId, 'setup', expiresAt);

    // Parse list numbers — detect CSV vs plain text
    let lists: { list_number: string; label?: string }[] = [];

    if (listNumbers.includes(',')) {
      // Try CSV parse
      const parsed = Papa.parse(listNumbers, { header: true, skipEmptyLines: true });
      lists = parsed.data.map((row: any) => ({
        list_number: row.list_number || row['List Number'] || Object.values(row)[0] as string,
        label: row.label || row.Label || row.turf || row.Turf || undefined,
      }));
    } else {
      // Plain text, one per line
      lists = listNumbers
        .split('\n')
        .map((n: string) => n.trim())
        .filter(Boolean)
        .map((n: string) => ({ list_number: n }));
    }

    const insertList = db.prepare(
      'INSERT INTO lists (session_id, list_number, label) VALUES (?, ?, ?)'
    );
    for (const list of lists) {
      insertList.run(id, list.list_number, list.label || null);
    }

    const savedLists = db.prepare('SELECT * FROM lists WHERE session_id = ?').all(id);

    res.status(201).json({ id, name, status: 'setup', lists: savedLists });
  });

  router.get('/:id', (req, res) => {
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Not found' });

    const lists = db.prepare('SELECT * FROM lists WHERE session_id = ?').all(req.params.id);
    const groups = db.prepare('SELECT * FROM groups WHERE session_id = ?').all(req.params.id);
    const canvassers = db.prepare('SELECT * FROM canvassers WHERE session_id = ?').all(req.params.id);

    res.json({ ...(session as any), lists, groups, canvassers });
  });

  return router;
}
```

**Step 4: Add supertest dev dependency**

Add to `server/package.json` devDependencies: `"supertest": "^7.0.0"`, `"@types/supertest": "^6.0.0"`

**Step 5: Run test to verify it passes**

Run: `cd server && npx vitest run routes/sessions.test.ts`
Expected: PASS

**Step 6: Wire up to server/index.ts**

Add the sessions router to the Express app:
```typescript
import { sessionsRouter } from './routes/sessions';
import { createDatabase } from './db/index';

const db = createDatabase('./data/canvasmate.db');
app.use(express.json());
app.use('/api/sessions', sessionsRouter(db));
```

**Step 7: Commit**

```bash
git add server/routes/ server/index.ts server/package.json
git commit -m "feat: session creation API with txt/csv list parsing"
```

---

## Task 4: Canvasser Check-in API

**Files:**
- Create: `server/routes/checkin.ts`
- Create: `server/routes/checkin.test.ts`
- Modify: `server/index.ts`

**Step 1: Write the failing test**

`server/routes/checkin.test.ts`:
```typescript
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
```

**Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run routes/checkin.test.ts`
Expected: FAIL

**Step 3: Implement check-in router**

`server/routes/checkin.ts`:
```typescript
import { Router } from 'express';
import Database from 'better-sqlite3';
import { nanoid } from 'nanoid';

export function checkinRouter(db: Database.Database) {
  const router = Router();

  router.post('/', (req, res) => {
    const { sessionId, displayName, phone, minivanId } = req.body;

    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId) as any;
    if (!session || session.status !== 'active') {
      return res.status(400).json({ error: 'Session is not accepting check-ins' });
    }

    const sessionToken = nanoid(16);

    db.prepare(
      'INSERT INTO canvassers (session_id, display_name, phone, minivan_id, session_token) VALUES (?, ?, ?, ?, ?)'
    ).run(sessionId, displayName, phone || null, minivanId || null, sessionToken);

    res.status(201).json({ sessionToken, displayName, sessionId });
  });

  return router;
}
```

**Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run routes/checkin.test.ts`
Expected: PASS

**Step 5: Wire up and commit**

```bash
git add server/routes/checkin.ts server/routes/checkin.test.ts server/index.ts
git commit -m "feat: canvasser check-in endpoint"
```

---

## Task 5: WebSocket Real-time Layer

**Files:**
- Create: `server/ws/index.ts`
- Create: `server/ws/index.test.ts`
- Modify: `server/index.ts`

**Step 1: Write the failing test**

`server/ws/index.test.ts`:
```typescript
import { describe, it, expect, afterEach } from 'vitest';
import { createServer } from 'http';
import express from 'express';
import WebSocket from 'ws';
import { setupWebSocket } from './index';

describe('WebSocket', () => {
  let server: ReturnType<typeof createServer>;
  let port: number;

  afterEach(() => server?.close());

  it('broadcasts session updates to connected clients', async () => {
    const app = express();
    server = createServer(app);
    const { broadcast } = setupWebSocket(server);
    
    await new Promise<void>((resolve) => server.listen(0, resolve));
    port = (server.address() as any).port;

    const client = new WebSocket(`ws://localhost:${port}/ws/session/test-123`);
    
    await new Promise<void>((resolve) => client.on('open', resolve));

    const messagePromise = new Promise<any>((resolve) => {
      client.on('message', (data) => resolve(JSON.parse(data.toString())));
    });

    broadcast('test-123', { type: 'canvasser_joined', name: 'Alice' });

    const msg = await messagePromise;
    expect(msg.type).toBe('canvasser_joined');
    expect(msg.name).toBe('Alice');

    client.close();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run ws/index.test.ts`
Expected: FAIL

**Step 3: Implement WebSocket module**

`server/ws/index.ts`:
```typescript
import { Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';

const sessions = new Map<string, Set<WebSocket>>();

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: undefined });

  server.on('upgrade', (req: IncomingMessage, socket, head) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const match = url.pathname.match(/^\/ws\/session\/(.+)$/);
    if (!match) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      const sessionId = match[1];
      if (!sessions.has(sessionId)) sessions.set(sessionId, new Set());
      sessions.get(sessionId)!.add(ws);

      ws.on('close', () => {
        sessions.get(sessionId)?.delete(ws);
        if (sessions.get(sessionId)?.size === 0) sessions.delete(sessionId);
      });
    });
  });

  function broadcast(sessionId: string, data: any) {
    const clients = sessions.get(sessionId);
    if (!clients) return;
    const msg = JSON.stringify(data);
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    }
  }

  return { broadcast };
}
```

**Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run ws/index.test.ts`
Expected: PASS

**Step 5: Wire into server/index.ts and commit**

```bash
git add server/ws/
git commit -m "feat: WebSocket real-time broadcast per session"
```

---

## Task 6: Assignment API (Groups + Drag-and-Drop Backend)

**Files:**
- Create: `server/routes/assignments.ts`
- Create: `server/routes/assignments.test.ts`
- Modify: `server/index.ts`

**Step 1: Write the failing test**

`server/routes/assignments.test.ts`:
```typescript
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
```

**Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run routes/assignments.test.ts`
Expected: FAIL

**Step 3: Implement assignments router**

`server/routes/assignments.ts`:
```typescript
import { Router } from 'express';
import Database from 'better-sqlite3';

export function assignmentsRouter(db: Database.Database, broadcast: (sessionId: string, data: any) => void) {
  const router = Router();

  router.post('/groups', (req, res) => {
    const { sessionId, name, listIds, canvasserIds } = req.body;

    const result = db.prepare(
      'INSERT INTO groups (session_id, name) VALUES (?, ?)'
    ).run(sessionId, name);

    const groupId = result.lastInsertRowid;

    const insertGroupList = db.prepare('INSERT INTO group_lists (group_id, list_id) VALUES (?, ?)');
    for (const listId of listIds) {
      insertGroupList.run(groupId, listId);
    }

    const updateCanvasser = db.prepare('UPDATE canvassers SET group_id = ? WHERE id = ?');
    for (const cid of canvasserIds) {
      updateCanvasser.run(groupId, cid);
    }

    broadcast(sessionId, {
      type: 'group_created',
      group: { id: groupId, name, listIds, canvasserIds },
    });

    res.status(201).json({ id: groupId, name, listIds, canvasserIds });
  });

  router.post('/solo', (req, res) => {
    const { sessionId, canvasserId, listId } = req.body;

    // Create a solo group
    const result = db.prepare(
      'INSERT INTO groups (session_id, name) VALUES (?, ?)'
    ).run(sessionId, `Solo`);

    const groupId = result.lastInsertRowid;
    db.prepare('INSERT INTO group_lists (group_id, list_id) VALUES (?, ?)').run(groupId, listId);
    db.prepare('UPDATE canvassers SET group_id = ? WHERE id = ?').run(groupId, canvasserId);

    broadcast(sessionId, {
      type: 'solo_assigned',
      canvasserId,
      listId,
      groupId,
    });

    res.status(200).json({ groupId, canvasserId, listId });
  });

  return router;
}
```

**Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run routes/assignments.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add server/routes/assignments.ts server/routes/assignments.test.ts
git commit -m "feat: group creation and canvasser assignment API"
```

---

## Task 7: Organizer Auth (Minimal)

**Files:**
- Create: `server/routes/auth.ts`
- Create: `server/routes/auth.test.ts`
- Modify: `server/index.ts`

**Step 1: Write the failing test**

`server/routes/auth.test.ts`:
```typescript
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
```

**Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run routes/auth.test.ts`
Expected: FAIL

**Step 3: Implement auth router**

Use `crypto.scrypt` from Node.js (no external bcrypt dependency needed):

`server/routes/auth.ts`:
```typescript
import { Router } from 'express';
import Database from 'better-sqlite3';
import { nanoid } from 'nanoid';
import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${buf.toString('hex')}`;
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [salt, key] = hash.split(':');
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  const keyBuf = Buffer.from(key, 'hex');
  return timingSafeEqual(buf, keyBuf);
}

export function authRouter(db: Database.Database) {
  const router = Router();

  router.post('/register', async (req, res) => {
    const { email, password } = req.body;
    const id = nanoid(12);
    const passwordHash = await hashPassword(password);

    try {
      db.prepare('INSERT INTO organizers (id, email, password_hash) VALUES (?, ?, ?)').run(id, email, passwordHash);
    } catch {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const token = nanoid(32);
    res.status(201).json({ id, token });
  });

  router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const org = db.prepare('SELECT * FROM organizers WHERE email = ?').get(email) as any;

    if (!org || !(await verifyPassword(password, org.password_hash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = nanoid(32);
    res.status(200).json({ id: org.id, token });
  });

  return router;
}
```

Note: For v1 we use a simple token returned to the client (stored in localStorage). No JWT complexity needed yet.

**Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run routes/auth.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add server/routes/auth.ts server/routes/auth.test.ts
git commit -m "feat: organizer registration and login"
```

---

## Task 8: Client — Check-in Flow

**Files:**
- Create: `client/src/pages/CheckIn.tsx`
- Create: `client/src/pages/CheckIn.test.tsx`
- Create: `client/src/hooks/useSession.ts`
- Modify: `client/src/App.tsx`

**Step 1: Write the failing test**

`client/src/pages/CheckIn.test.tsx`:
```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CheckIn from './CheckIn';

describe('CheckIn', () => {
  it('renders name input and submit button', () => {
    render(<CheckIn sessionId="test-123" />);
    expect(screen.getByPlaceholderText(/your name/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /check in/i })).toBeDefined();
  });

  it('submits check-in with display name', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sessionToken: 'tok-123', displayName: 'Alice' }),
    });
    global.fetch = mockFetch;

    render(<CheckIn sessionId="test-123" />);
    fireEvent.change(screen.getByPlaceholderText(/your name/i), { target: { value: 'Alice' } });
    fireEvent.click(screen.getByRole('button', { name: /check in/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/checkin', expect.objectContaining({
        method: 'POST',
      }));
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/pages/CheckIn.test.tsx`
Expected: FAIL

**Step 3: Implement CheckIn component**

`client/src/pages/CheckIn.tsx`:
```tsx
import { useState } from 'react';

interface Props {
  sessionId: string;
  onCheckedIn?: (token: string) => void;
}

export default function CheckIn({ sessionId, onCheckedIn }: Props) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [minivanId, setMinivanId] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const res = await fetch('/api/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, displayName: name, phone: phone || undefined, minivanId: minivanId || undefined }),
    });

    if (res.ok) {
      const data = await res.json();
      onCheckedIn?.(data.sessionToken);
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-sm mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold text-center">Check In</h1>

      <input
        type="text"
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        className="w-full p-3 border rounded-lg text-lg"
      />

      <input
        type="tel"
        placeholder="Phone (optional, for Signal group)"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="w-full p-3 border rounded-lg"
      />

      <input
        type="text"
        placeholder="MiniVAN ID (optional)"
        value={minivanId}
        onChange={(e) => setMinivanId(e.target.value)}
        className="w-full p-3 border rounded-lg"
      />

      <button
        type="submit"
        disabled={!name || loading}
        className="w-full p-3 bg-blue-600 text-white rounded-lg font-bold text-lg disabled:opacity-50"
      >
        {loading ? 'Checking in...' : 'Check In'}
      </button>
    </form>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/pages/CheckIn.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add client/src/pages/ client/src/App.tsx
git commit -m "feat: canvasser check-in UI"
```

---

## Task 9: Client — Organizer Assignment Board

**Files:**
- Create: `client/src/pages/AssignmentBoard.tsx`
- Create: `client/src/pages/AssignmentBoard.test.tsx`
- Create: `client/src/components/CanvasserCard.tsx`
- Create: `client/src/components/GroupColumn.tsx`
- Create: `client/src/hooks/useWebSocket.ts`

**Step 1: Write the failing test**

`client/src/pages/AssignmentBoard.test.tsx`:
```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AssignmentBoard from './AssignmentBoard';

vi.mock('../hooks/useWebSocket', () => ({
  useWebSocket: () => ({ connected: true }),
}));

describe('AssignmentBoard', () => {
  const mockSession = {
    id: 'test-123',
    name: 'Saturday Canvass',
    lists: [
      { id: 1, list_number: '4821093', label: 'Elm St' },
      { id: 2, list_number: '4821094', label: 'Oak Ave' },
    ],
    groups: [],
    canvassers: [
      { id: 1, display_name: 'Alice', group_id: null },
      { id: 2, display_name: 'Bob', group_id: null },
    ],
  };

  it('renders unassigned canvassers', () => {
    render(<AssignmentBoard session={mockSession} />);
    expect(screen.getByText('Alice')).toBeDefined();
    expect(screen.getByText('Bob')).toBeDefined();
  });

  it('renders list columns', () => {
    render(<AssignmentBoard session={mockSession} />);
    expect(screen.getByText('4821093')).toBeDefined();
    expect(screen.getByText('Elm St')).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/pages/AssignmentBoard.test.tsx`
Expected: FAIL

**Step 3: Implement WebSocket hook**

`client/src/hooks/useWebSocket.ts`:
```typescript
import { useEffect, useRef, useState, useCallback } from 'react';

export function useWebSocket(sessionId: string, onMessage: (data: any) => void) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/session/${sessionId}`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (e) => onMessage(JSON.parse(e.data));

    return () => ws.close();
  }, [sessionId]);

  return { connected };
}
```

**Step 4: Implement components**

`client/src/components/CanvasserCard.tsx`:
```tsx
import { useDraggable } from '@dnd-kit/core';

interface Props {
  id: number;
  name: string;
}

export default function CanvasserCard({ id, name }: Props) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: `canvasser-${id}` });

  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="p-3 bg-white rounded-lg shadow border cursor-grab active:cursor-grabbing"
    >
      {name}
    </div>
  );
}
```

`client/src/components/GroupColumn.tsx`:
```tsx
import { useDroppable } from '@dnd-kit/core';

interface Props {
  id: string;
  listNumber: string;
  label?: string;
  children: React.ReactNode;
}

export default function GroupColumn({ id, listNumber, label, children }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-w-[200px] p-4 rounded-lg border-2 border-dashed ${
        isOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
      }`}
    >
      <div className="font-bold text-lg">{listNumber}</div>
      {label && <div className="text-sm text-gray-500">{label}</div>}
      <div className="mt-3 space-y-2">{children}</div>
    </div>
  );
}
```

**Step 5: Implement AssignmentBoard**

`client/src/pages/AssignmentBoard.tsx`:
```tsx
import { useState, useCallback } from 'react';
import { DndContext, DragEndEvent } from '@dnd-kit/core';
import { useWebSocket } from '../hooks/useWebSocket';
import CanvasserCard from '../components/CanvasserCard';
import GroupColumn from '../components/GroupColumn';

interface Session {
  id: string;
  name: string;
  lists: { id: number; list_number: string; label?: string }[];
  groups: { id: number; name: string; listIds: number[]; canvasserIds: number[] }[];
  canvassers: { id: number; display_name: string; group_id: number | null }[];
}

interface Props {
  session: Session;
}

export default function AssignmentBoard({ session: initial }: Props) {
  const [canvassers, setCanvassers] = useState(initial.canvassers);
  const [groups, setGroups] = useState(initial.groups);

  const onMessage = useCallback((data: any) => {
    if (data.type === 'canvasser_joined') {
      setCanvassers((prev) => [...prev, data.canvasser]);
    }
  }, []);

  useWebSocket(initial.id, onMessage);

  const unassigned = canvassers.filter((c) => !c.group_id);

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const canvasserId = parseInt(active.id.toString().replace('canvasser-', ''));
    const listId = parseInt(over.id.toString().replace('list-', ''));

    await fetch('/api/assignments/solo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: initial.id, canvasserId, listId }),
    });

    setCanvassers((prev) =>
      prev.map((c) => (c.id === canvasserId ? { ...c, group_id: -1 } : c))
    );
  }

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="min-h-screen p-6">
        <h1 className="text-2xl font-bold mb-6">{initial.name}</h1>

        <div className="flex gap-6">
          {/* Unassigned column */}
          <div className="w-64 shrink-0">
            <h2 className="font-bold text-lg mb-3">Unassigned ({unassigned.length})</h2>
            <div className="space-y-2">
              {unassigned.map((c) => (
                <CanvasserCard key={c.id} id={c.id} name={c.display_name} />
              ))}
            </div>
          </div>

          {/* List columns */}
          <div className="flex gap-4 flex-1 overflow-x-auto">
            {initial.lists.map((list) => (
              <GroupColumn
                key={list.id}
                id={`list-${list.id}`}
                listNumber={list.list_number}
                label={list.label}
              >
                {canvassers
                  .filter((c) => c.group_id && c.group_id !== null)
                  .map((c) => (
                    <div key={c.id} className="p-2 bg-green-50 rounded text-sm">
                      {c.display_name}
                    </div>
                  ))}
              </GroupColumn>
            ))}
          </div>
        </div>
      </div>
    </DndContext>
  );
}
```

**Step 6: Run test to verify it passes**

Run: `cd client && npx vitest run src/pages/AssignmentBoard.test.tsx`
Expected: PASS

**Step 7: Commit**

```bash
git add client/src/
git commit -m "feat: drag-and-drop assignment board with real-time updates"
```

---

## Task 10: Client — Canvasser Waiting/Assignment View

**Files:**
- Create: `client/src/pages/CanvasserView.tsx`
- Create: `client/src/pages/CanvasserView.test.tsx`

**Step 1: Write the failing test**

`client/src/pages/CanvasserView.test.tsx`:
```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CanvasserView from './CanvasserView';

vi.mock('../hooks/useWebSocket', () => ({
  useWebSocket: (_id: string, _cb: any) => ({ connected: true }),
}));

describe('CanvasserView', () => {
  it('shows waiting state when unassigned', () => {
    render(<CanvasserView sessionId="test" sessionToken="tok" assignment={null} />);
    expect(screen.getByText(/waiting for assignment/i)).toBeDefined();
  });

  it('shows list number when assigned', () => {
    render(
      <CanvasserView
        sessionId="test"
        sessionToken="tok"
        assignment={{ listNumber: '4821093', groupName: 'Team A', members: ['Alice', 'Bob'] }}
      />
    );
    expect(screen.getByText('4821093')).toBeDefined();
    expect(screen.getByText('Team A')).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/pages/CanvasserView.test.tsx`
Expected: FAIL

**Step 3: Implement CanvasserView**

`client/src/pages/CanvasserView.tsx`:
```tsx
import { useState } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';

interface Assignment {
  listNumber: string;
  groupName: string;
  members: string[];
  signalLink?: string;
}

interface Props {
  sessionId: string;
  sessionToken: string;
  assignment: Assignment | null;
}

export default function CanvasserView({ sessionId, sessionToken, assignment: initial }: Props) {
  const [assignment, setAssignment] = useState(initial);

  useWebSocket(sessionId, (data) => {
    if (data.type === 'assigned' && data.sessionToken === sessionToken) {
      setAssignment(data.assignment);
    }
    if (data.type === 'signal_group_created' && data.sessionToken === sessionToken) {
      setAssignment((prev) => prev ? { ...prev, signalLink: data.signalLink } : prev);
    }
  });

  if (!assignment) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">&#9203;</div>
          <p className="text-xl text-gray-600">Waiting for assignment...</p>
          <p className="text-sm text-gray-400 mt-2">Your organizer is setting up groups</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 space-y-6">
      <div className="text-center">
        <p className="text-sm text-gray-500 uppercase tracking-wide">Your list number</p>
        <p className="text-6xl font-bold text-blue-600 mt-2">{assignment.listNumber}</p>
        <button
          onClick={() => navigator.clipboard.writeText(assignment.listNumber)}
          className="mt-3 px-4 py-2 bg-gray-100 rounded-lg text-sm"
        >
          Copy to clipboard
        </button>
      </div>

      <div className="text-center">
        <p className="font-bold text-lg">{assignment.groupName}</p>
        <div className="mt-2 space-y-1">
          {assignment.members.map((m) => (
            <p key={m} className="text-gray-600">{m}</p>
          ))}
        </div>
      </div>

      {assignment.signalLink && (
        <a
          href={assignment.signalLink}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-bold"
        >
          Join Signal Group
        </a>
      )}
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/pages/CanvasserView.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add client/src/pages/CanvasserView.tsx client/src/pages/CanvasserView.test.tsx
git commit -m "feat: canvasser waiting and assignment view"
```

---

## Task 11: QR Code Session Sharing

**Files:**
- Create: `client/src/components/SessionQR.tsx`
- Create: `client/src/components/SessionQR.test.tsx`

**Step 1: Write the failing test**

`client/src/components/SessionQR.test.tsx`:
```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import SessionQR from './SessionQR';

describe('SessionQR', () => {
  it('renders QR code with session URL', () => {
    render(<SessionQR sessionId="SAT-W5" baseUrl="https://canvasmate.local" />);
    const svg = document.querySelector('svg');
    expect(svg).toBeDefined();
  });

  it('shows the join URL as text', () => {
    render(<SessionQR sessionId="SAT-W5" baseUrl="https://canvasmate.local" />);
    expect(screen.getByText(/canvasmate.local\/join\/SAT-W5/)).toBeDefined();
  });
});
```

**Step 2: Run test, then implement**

`client/src/components/SessionQR.tsx`:
```tsx
import { QRCodeSVG } from 'qrcode.react';

interface Props {
  sessionId: string;
  baseUrl: string;
}

export default function SessionQR({ sessionId, baseUrl }: Props) {
  const url = `${baseUrl}/join/${sessionId}`;

  return (
    <div className="flex flex-col items-center space-y-4 p-6">
      <QRCodeSVG value={url} size={256} level="M" />
      <p className="text-sm text-gray-500 font-mono">{url}</p>
    </div>
  );
}
```

**Step 3: Run test to verify it passes**

Run: `cd client && npx vitest run src/components/SessionQR.test.tsx`
Expected: PASS

**Step 4: Commit**

```bash
git add client/src/components/SessionQR.tsx client/src/components/SessionQR.test.tsx
git commit -m "feat: QR code component for session check-in"
```

---

## Task 12: Signal Group Integration

**Files:**
- Create: `server/services/signal.ts`
- Create: `server/services/signal.test.ts`
- Create: `server/routes/lock.ts`

**Step 1: Write the failing test**

`server/services/signal.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { SignalService } from './signal';

describe('SignalService', () => {
  it('creates a group and returns invite link', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ link: 'https://signal.group/#abc123' }),
    });

    const signal = new SignalService('http://localhost:8080', mockFetch as any);
    const result = await signal.createGroup('Sat W5 - Team A', ['+15551111111', '+15552222222']);

    expect(result.link).toBe('https://signal.group/#abc123');
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8080/v2/groups',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('returns null link when Signal API is unavailable', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Connection refused'));
    const signal = new SignalService('http://localhost:8080', mockFetch as any);
    const result = await signal.createGroup('Test', ['+15551111111']);

    expect(result.link).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run services/signal.test.ts`
Expected: FAIL

**Step 3: Implement Signal service**

`server/services/signal.ts`:
```typescript
type FetchFn = typeof globalThis.fetch;

export class SignalService {
  constructor(
    private baseUrl: string,
    private fetchFn: FetchFn = globalThis.fetch
  ) {}

  async createGroup(name: string, members: string[]): Promise<{ link: string | null }> {
    try {
      const res = await this.fetchFn(`${this.baseUrl}/v2/groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          members,
          permissions: { addMembers: 'only-admins', editGroup: 'only-admins' },
          groupLinkState: 'enabled',
        }),
      });

      if (!res.ok) return { link: null };
      const data = await res.json();
      return { link: data.link || null };
    } catch {
      return { link: null };
    }
  }
}
```

**Step 4: Implement lock endpoint**

`server/routes/lock.ts`:
```typescript
import { Router } from 'express';
import Database from 'better-sqlite3';
import { SignalService } from '../services/signal';

export function lockRouter(
  db: Database.Database,
  signal: SignalService,
  broadcast: (sessionId: string, data: any) => void
) {
  const router = Router();

  router.post('/:sessionId/lock', async (req, res) => {
    const { sessionId } = req.params;
    db.prepare("UPDATE sessions SET status = 'locked' WHERE id = ?").run(sessionId);

    // Create Signal groups per group
    const groups = db.prepare('SELECT * FROM groups WHERE session_id = ?').all(sessionId) as any[];
    const session = db.prepare('SELECT name FROM sessions WHERE id = ?').get(sessionId) as any;

    for (const group of groups) {
      const members = db.prepare(
        'SELECT phone FROM canvassers WHERE group_id = ? AND phone IS NOT NULL'
      ).all(group.id) as any[];

      const phones = members.map((m: any) => m.phone).filter(Boolean);
      if (phones.length === 0) continue;

      const result = await signal.createGroup(`${session.name} - ${group.name}`, phones);
      if (result.link) {
        db.prepare('UPDATE groups SET signal_group_link = ? WHERE id = ?').run(result.link, group.id);
      }
    }

    broadcast(sessionId, { type: 'session_locked' });
    res.json({ status: 'locked' });
  });

  return router;
}
```

**Step 5: Run test to verify it passes**

Run: `cd server && npx vitest run services/signal.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add server/services/ server/routes/lock.ts
git commit -m "feat: Signal group creation on session lock"
```

---

## Task 13: Session Cleanup / Data Purge

**Files:**
- Create: `server/services/cleanup.ts`
- Create: `server/services/cleanup.test.ts`

**Step 1: Write the failing test**

`server/services/cleanup.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase } from '../db/index';
import { purgeExpiredSessions } from './cleanup';

describe('purgeExpiredSessions', () => {
  let db: ReturnType<typeof createDatabase>;

  beforeEach(() => {
    db = createDatabase(':memory:');
    // Insert expired session
    db.prepare(
      "INSERT INTO sessions (id, name, organizer_id, status, expires_at) VALUES (?, ?, ?, ?, datetime('now', '-1 hour'))"
    ).run('expired-1', 'Old Session', 'org-1', 'closed');
    db.prepare(
      "INSERT INTO canvassers (session_id, display_name, phone, session_token) VALUES (?, ?, ?, ?)"
    ).run('expired-1', 'Alice', '+15551234567', 'tok-1');

    // Insert active session
    db.prepare(
      "INSERT INTO sessions (id, name, organizer_id, status, expires_at) VALUES (?, ?, ?, ?, datetime('now', '+23 hours'))"
    ).run('active-1', 'Current Session', 'org-1', 'active');
  });

  it('deletes expired sessions and their canvassers', () => {
    const purged = purgeExpiredSessions(db);
    expect(purged).toBe(1);

    const sessions = db.prepare('SELECT * FROM sessions').all();
    expect(sessions).toHaveLength(1);

    const canvassers = db.prepare('SELECT * FROM canvassers').all();
    expect(canvassers).toHaveLength(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run services/cleanup.test.ts`
Expected: FAIL

**Step 3: Implement cleanup**

`server/services/cleanup.ts`:
```typescript
import Database from 'better-sqlite3';

export function purgeExpiredSessions(db: Database.Database): number {
  const expired = db.prepare(
    "SELECT id FROM sessions WHERE expires_at < datetime('now')"
  ).all() as any[];

  for (const session of expired) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(session.id);
    // CASCADE handles canvassers, groups, lists
  }

  return expired.length;
}
```

Wire into server startup with `setInterval`:
```typescript
// In server/index.ts
import { purgeExpiredSessions } from './services/cleanup';
setInterval(() => purgeExpiredSessions(db), 60 * 60 * 1000); // hourly
```

**Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run services/cleanup.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add server/services/cleanup.ts server/services/cleanup.test.ts
git commit -m "feat: automatic purge of expired sessions (PII cleanup)"
```

---

## Task 14: Client Routing & App Shell

**Files:**
- Modify: `client/src/App.tsx`
- Create: `client/src/pages/OrganizerDashboard.tsx`
- Create: `client/src/pages/CreateSession.tsx`

**Step 1: Install router**

Add `react-router-dom` to client dependencies.

**Step 2: Implement routing**

`client/src/App.tsx`:
```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import OrganizerDashboard from './pages/OrganizerDashboard';
import CreateSession from './pages/CreateSession';
import CheckIn from './pages/CheckIn';
import CanvasserView from './pages/CanvasserView';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<OrganizerDashboard />} />
        <Route path="/session/new" element={<CreateSession />} />
        <Route path="/session/:id" element={<div>AssignmentBoard (loaded with session data)</div>} />
        <Route path="/join/:sessionId" element={<CheckIn sessionId="" />} />
      </Routes>
    </BrowserRouter>
  );
}
```

**Step 3: Implement CreateSession (upload flow)**

`client/src/pages/CreateSession.tsx`:
```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function CreateSession() {
  const [name, setName] = useState('');
  const [listInput, setListInput] = useState('');
  const navigate = useNavigate();

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setListInput(text);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, listNumbers: listInput, organizerId: 'temp' }),
    });
    const session = await res.json();
    navigate(`/session/${session.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">New Canvass Session</h1>

      <input
        type="text"
        placeholder="Session name (e.g., Saturday Ward 5)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        className="w-full p-3 border rounded-lg"
      />

      <div className="space-y-2">
        <label className="block font-medium">List numbers</label>
        <textarea
          placeholder="Paste list numbers, one per line"
          value={listInput}
          onChange={(e) => setListInput(e.target.value)}
          rows={6}
          className="w-full p-3 border rounded-lg font-mono text-sm"
        />
        <p className="text-sm text-gray-500">Or upload a file:</p>
        <input
          type="file"
          accept=".txt,.csv"
          onChange={handleFileUpload}
          className="text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={!name || !listInput}
        className="w-full p-3 bg-blue-600 text-white rounded-lg font-bold disabled:opacity-50"
      >
        Create Session
      </button>
    </form>
  );
}
```

**Step 4: Commit**

```bash
git add client/src/
git commit -m "feat: app routing, session creation UI with file upload"
```

---

## Task 15: End-to-End Integration Test

**Files:**
- Create: `e2e/flow.test.ts`

**Step 1: Write integration test**

`e2e/flow.test.ts`:
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const BASE = 'http://localhost:3000';

describe('full canvass flow', () => {
  it('creates session, checks in, assigns, and locks', async () => {
    // 1. Create session
    const session = await fetch(`${BASE}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'E2E Test', listNumbers: '111\n222', organizerId: 'org-1' }),
    }).then((r) => r.json());

    expect(session.id).toBeDefined();

    // 2. Activate session
    // (In production this would be through the UI)
    await fetch(`${BASE}/api/sessions/${session.id}/activate`, { method: 'POST' });

    // 3. Check in canvassers
    const alice = await fetch(`${BASE}/api/checkin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: session.id, displayName: 'Alice', phone: '+15551111111' }),
    }).then((r) => r.json());

    expect(alice.sessionToken).toBeDefined();

    // 4. Assign to group
    const group = await fetch(`${BASE}/api/assignments/groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: session.id,
        name: 'Team A',
        listIds: [session.lists?.[0]?.id || 1],
        canvasserIds: [1],
      }),
    }).then((r) => r.json());

    expect(group.id).toBeDefined();

    // 5. Lock session
    const lock = await fetch(`${BASE}/api/sessions/${session.id}/lock`, { method: 'POST' }).then((r) => r.json());
    expect(lock.status).toBe('locked');
  });
});
```

**Step 2: Run with server running**

Run: `npm run dev:server & sleep 2 && npx vitest run e2e/flow.test.ts`

**Step 3: Commit**

```bash
git add e2e/
git commit -m "test: end-to-end integration test for full canvass flow"
```

---

## Summary

| Task | What it builds |
|------|---------------|
| 1 | Project scaffolding, monorepo, Docker |
| 2 | Database schema & migrations |
| 3 | Session CRUD API (with txt/csv parsing) |
| 4 | Canvasser check-in API |
| 5 | WebSocket real-time layer |
| 6 | Assignment API (groups + solo) |
| 7 | Organizer auth |
| 8 | Client: Check-in UI |
| 9 | Client: Assignment board (drag-and-drop) |
| 10 | Client: Canvasser waiting/assignment view |
| 11 | QR code session sharing |
| 12 | Signal group integration |
| 13 | Session cleanup / data purge |
| 14 | Client routing & session creation UI |
| 15 | End-to-end integration test |
