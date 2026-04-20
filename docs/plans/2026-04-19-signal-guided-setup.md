# Signal Guided Setup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let organizers connect their Signal number through the app UI (enter phone, receive SMS code, verify) so group creation works automatically when sessions are locked.

**Architecture:** Add a `settings` table to store the registered Signal phone number. Add backend endpoints that proxy signal-cli-rest-api registration/verify/status calls. Add a frontend setup screen that guides the organizer through SMS verification. Fix `SignalService` to use the correct API paths (v1 endpoints with sender number). The signal-cli-rest-api sidecar is already in docker-compose.yml.

**Tech Stack:** Express routes, better-sqlite3 migration, React components, signal-cli-rest-api v1 endpoints

---

## Task 1: Database Migration for Settings Table

**Files:**
- Create: `server/db/migrations/002-settings.sql`
- Modify: `server/db/index.ts`
- Test: `server/db/index.test.ts`

**Step 1: Write the failing test**

Add to `server/db/index.test.ts`:
```typescript
it('creates settings table', () => {
  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='settings'"
  ).all();
  expect(tables).toHaveLength(1);
});
```

**Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run db/index.test.ts`
Expected: FAIL — settings table does not exist

**Step 3: Write the migration**

`server/db/migrations/002-settings.sql`:
```sql
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

**Step 4: Update createDatabase to run the new migration**

In `server/db/index.ts`, the migration runner currently only handles `001-initial-schema.sql` with a hardcoded filename. Refactor it to iterate over all `.sql` files in the migrations directory in sorted order:

```typescript
import Database from 'better-sqlite3';
import { readFileSync, readdirSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createDatabase(path: string) {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`CREATE TABLE IF NOT EXISTS migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  const applied = new Set(
    db.prepare('SELECT name FROM migrations').all().map((r: any) => r.name)
  );

  const migrationsDir = join(__dirname, 'migrations');
  const files = readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  for (const file of files) {
    if (!applied.has(file)) {
      const sql = readFileSync(join(migrationsDir, file), 'utf-8');
      db.exec(sql);
      db.prepare('INSERT INTO migrations (name) VALUES (?)').run(file);
    }
  }

  return db;
}
```

**Step 5: Run test to verify it passes**

Run: `cd server && npx vitest run db/index.test.ts`
Expected: PASS (all 5 tests)

**Step 6: Commit**

```bash
git add server/db/
git commit -m "feat: settings table migration, refactor migration runner"
```

---

## Task 2: Signal Setup Backend Endpoints

**Files:**
- Create: `server/routes/signal-setup.ts`
- Create: `server/routes/signal-setup.test.ts`
- Modify: `server/services/signal.ts`
- Modify: `server/index.ts`

**Step 1: Write the failing test**

`server/routes/signal-setup.test.ts`:
```typescript
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
```

**Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run routes/signal-setup.test.ts`
Expected: FAIL — module not found

**Step 3: Add register/verify/accounts methods to SignalService**

Modify `server/services/signal.ts`:
```typescript
type FetchFn = typeof globalThis.fetch;

export class SignalService {
  constructor(
    private baseUrl: string,
    private fetchFn: FetchFn = globalThis.fetch
  ) {}

  async register(number: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await this.fetchFn(`${this.baseUrl}/v1/register/${number}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ use_voice: false }),
      });
      if (!res.ok) return { ok: false, error: await res.text() };
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }

  async verify(number: string, code: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await this.fetchFn(`${this.baseUrl}/v1/register/${number}/verify/${code}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) return { ok: false, error: await res.text() };
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }

  async getAccounts(): Promise<string[]> {
    try {
      const res = await this.fetchFn(`${this.baseUrl}/v1/accounts`, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  }

  async createGroup(name: string, members: string[], senderNumber: string): Promise<{ link: string | null }> {
    try {
      const res = await this.fetchFn(`${this.baseUrl}/v1/groups/${senderNumber}`, {
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

Note: `createGroup` now takes a `senderNumber` parameter and uses the correct `v1/groups/{number}` endpoint.

**Step 4: Implement signal-setup router**

`server/routes/signal-setup.ts`:
```typescript
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

    // Save the verified number
    db.prepare(
      "INSERT OR REPLACE INTO settings (key, value) VALUES ('signal_number', ?)"
    ).run(number);

    res.json({ status: 'configured', number });
  });

  return router;
}
```

**Step 5: Wire into server/index.ts**

Add:
```typescript
import { signalSetupRouter } from './routes/signal-setup';
app.use('/api/signal', signalSetupRouter(db, signal));
```

**Step 6: Run test to verify it passes**

Run: `cd server && npx vitest run routes/signal-setup.test.ts`
Expected: PASS (all 5 tests)

**Step 7: Commit**

```bash
git add server/routes/signal-setup.ts server/routes/signal-setup.test.ts server/services/signal.ts server/index.ts
git commit -m "feat: Signal registration and verification endpoints"
```

---

## Task 3: Fix SignalService Tests and Lock Router

**Files:**
- Modify: `server/services/signal.test.ts`
- Modify: `server/routes/lock.ts`

The `createGroup` signature changed (added `senderNumber` param). Update all callers.

**Step 1: Update signal.test.ts**

In `server/services/signal.test.ts`, update the `createGroup` calls to pass a sender number:

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
    const result = await signal.createGroup('Sat W5 - Team A', ['+15551111111', '+15552222222'], '+15559999999');

    expect(result.link).toBe('https://signal.group/#abc123');
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8080/v1/groups/+15559999999',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('returns null link when Signal API is unavailable', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Connection refused'));
    const signal = new SignalService('http://localhost:8080', mockFetch as any);
    const result = await signal.createGroup('Test', ['+15551111111'], '+15559999999');

    expect(result.link).toBeNull();
  });

  it('registers a phone number', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    const signal = new SignalService('http://localhost:8080', mockFetch as any);
    const result = await signal.register('+15551234567');

    expect(result.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8080/v1/register/+15551234567',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('verifies a phone number', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    const signal = new SignalService('http://localhost:8080', mockFetch as any);
    const result = await signal.verify('+15551234567', '123-456');

    expect(result.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8080/v1/register/+15551234567/verify/123-456',
      expect.objectContaining({ method: 'POST' })
    );
  });
});
```

**Step 2: Update lock.ts to read sender number from settings**

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

    // Get the registered Signal number
    const signalRow = db.prepare("SELECT value FROM settings WHERE key = 'signal_number'").get() as any;
    const senderNumber = signalRow?.value;

    if (senderNumber) {
      // Create Signal groups per group
      const groups = db.prepare('SELECT * FROM groups WHERE session_id = ?').all(sessionId) as any[];
      const session = db.prepare('SELECT name FROM sessions WHERE id = ?').get(sessionId) as any;

      for (const group of groups) {
        const members = db.prepare(
          'SELECT phone FROM canvassers WHERE group_id = ? AND phone IS NOT NULL'
        ).all(group.id) as any[];

        const phones = members.map((m: any) => m.phone).filter(Boolean);
        if (phones.length === 0) continue;

        const result = await signal.createGroup(`${session.name} - ${group.name}`, phones, senderNumber);
        if (result.link) {
          db.prepare('UPDATE groups SET signal_group_link = ? WHERE id = ?').run(result.link, group.id);
        }
      }
    }

    broadcast(sessionId, { type: 'session_locked' });
    res.json({ status: 'locked' });
  });

  return router;
}
```

**Step 3: Run all server tests**

Run: `cd server && npx vitest run`
Expected: ALL PASS

**Step 4: Commit**

```bash
git add server/services/signal.test.ts server/routes/lock.ts
git commit -m "fix: update Signal API to use v1 endpoints with sender number"
```

---

## Task 4: Signal Setup UI

**Files:**
- Create: `client/src/pages/SignalSetup.tsx`
- Create: `client/src/pages/SignalSetup.test.tsx`
- Modify: `client/src/App.tsx`
- Modify: `client/src/pages/OrganizerDashboard.tsx`

**Step 1: Write the failing test**

`client/src/pages/SignalSetup.test.tsx`:
```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SignalSetup from './SignalSetup';

describe('SignalSetup', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shows phone number input when not configured', () => {
    render(<SignalSetup initialStatus="not_configured" />);
    expect(screen.getByPlaceholderText(/phone number/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /send verification/i })).toBeDefined();
  });

  it('shows configured state with number', () => {
    render(<SignalSetup initialStatus="configured" initialNumber="+15551234567" />);
    expect(screen.getByText(/connected/i)).toBeDefined();
    expect(screen.getByText('+15551234567')).toBeDefined();
  });

  it('shows code input after sending verification', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'verification_sent' }),
    });

    render(<SignalSetup initialStatus="not_configured" />);
    fireEvent.change(screen.getByPlaceholderText(/phone number/i), { target: { value: '+15551234567' } });
    fireEvent.click(screen.getByRole('button', { name: /send verification/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/verification code/i)).toBeDefined();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/pages/SignalSetup.test.tsx`
Expected: FAIL — module not found

**Step 3: Implement SignalSetup component**

`client/src/pages/SignalSetup.tsx`:
```tsx
import { useState } from 'react';

interface Props {
  initialStatus: 'not_configured' | 'configured';
  initialNumber?: string;
  onConfigured?: () => void;
}

export default function SignalSetup({ initialStatus, initialNumber, onConfigured }: Props) {
  const [status, setStatus] = useState(initialStatus);
  const [number, setNumber] = useState(initialNumber || '');
  const [phoneInput, setPhoneInput] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSendVerification() {
    setLoading(true);
    setError(null);
    const res = await fetch('/api/signal/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ number: phoneInput }),
    });
    setLoading(false);

    if (res.ok) {
      setStep('code');
    } else {
      const data = await res.json();
      setError(data.error || 'Failed to send verification code');
    }
  }

  async function handleVerify() {
    setLoading(true);
    setError(null);
    const res = await fetch('/api/signal/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ number: phoneInput, code: codeInput }),
    });
    setLoading(false);

    if (res.ok) {
      setStatus('configured');
      setNumber(phoneInput);
      onConfigured?.();
    } else {
      const data = await res.json();
      setError(data.error || 'Verification failed');
    }
  }

  if (status === 'configured') {
    return (
      <div className="max-w-md mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Signal Integration</h1>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-800 font-bold">Connected</p>
          <p className="text-green-600 mt-1">{number}</p>
          <p className="text-sm text-green-500 mt-2">
            Signal groups will be created automatically when you lock a session.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Connect Signal</h1>
      <p className="text-gray-600 mb-6">
        Connect your phone number to automatically create Signal groups for canvass teams.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {step === 'phone' && (
        <div className="space-y-4">
          <input
            type="tel"
            placeholder="Phone number (e.g. +15551234567)"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            className="w-full p-3 border rounded-lg"
          />
          <button
            onClick={handleSendVerification}
            disabled={!phoneInput || loading}
            className="w-full p-3 bg-blue-600 text-white rounded-lg font-bold disabled:opacity-50"
          >
            {loading ? 'Sending...' : 'Send Verification Code'}
          </button>
        </div>
      )}

      {step === 'code' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            A verification code was sent to {phoneInput}
          </p>
          <input
            type="text"
            placeholder="Verification code (e.g. 123-456)"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            className="w-full p-3 border rounded-lg"
          />
          <button
            onClick={handleVerify}
            disabled={!codeInput || loading}
            className="w-full p-3 bg-green-600 text-white rounded-lg font-bold disabled:opacity-50"
          >
            {loading ? 'Verifying...' : 'Verify'}
          </button>
          <button
            onClick={() => { setStep('phone'); setError(null); }}
            className="w-full p-2 text-gray-500 text-sm"
          >
            Use a different number
          </button>
        </div>
      )}
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/pages/SignalSetup.test.tsx`
Expected: PASS

**Step 5: Add route and dashboard link**

In `client/src/App.tsx`, add:
```tsx
import SignalSetupPage from './pages/SignalSetupPage';
// Add route:
<Route path="/settings/signal" element={<SignalSetupPage />} />
```

Create `client/src/pages/SignalSetupPage.tsx` — a wrapper that fetches `/api/signal/status` and passes it to `SignalSetup`:
```tsx
import { useEffect, useState } from 'react';
import SignalSetup from './SignalSetup';

export default function SignalSetupPage() {
  const [status, setStatus] = useState<'not_configured' | 'configured' | null>(null);
  const [number, setNumber] = useState<string | undefined>();

  useEffect(() => {
    fetch('/api/signal/status')
      .then((r) => r.json())
      .then((data) => {
        setStatus(data.status);
        setNumber(data.number);
      })
      .catch(() => setStatus('not_configured'));
  }, []);

  if (!status) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return <SignalSetup initialStatus={status} initialNumber={number} />;
}
```

In `client/src/pages/OrganizerDashboard.tsx`, add a "Signal Settings" link:
```tsx
<Link
  to="/settings/signal"
  className="inline-block px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium"
>
  Signal Settings
</Link>
```

**Step 6: Commit**

```bash
git add client/src/pages/SignalSetup.tsx client/src/pages/SignalSetup.test.tsx client/src/pages/SignalSetupPage.tsx client/src/pages/OrganizerDashboard.tsx client/src/App.tsx
git commit -m "feat: Signal setup UI with phone verification flow"
```

---

## Task 5: Show Signal Status on Session Page

**Files:**
- Modify: `client/src/pages/SessionPage.tsx`

**Step 1: Add Signal status indicator to session page**

In `SessionPage.tsx`, fetch Signal status and show a warning if not configured when the organizer tries to lock:

Add to the toolbar area (next to the Lock Assignments button):
```tsx
// Fetch signal status on mount
const [signalConfigured, setSignalConfigured] = useState(false);

useEffect(() => {
  fetch('/api/signal/status')
    .then((r) => r.json())
    .then((data) => setSignalConfigured(data.status === 'configured'));
}, []);
```

In the active status section, next to the Lock button, add:
```tsx
{!signalConfigured && (
  <Link to="/settings/signal" className="text-sm text-amber-600 underline">
    Signal not configured
  </Link>
)}
```

This gives the organizer a visible nudge without blocking them — locking still works, it just won't create Signal groups.

**Step 2: Commit**

```bash
git add client/src/pages/SessionPage.tsx
git commit -m "feat: show Signal config status on session page"
```

---

## Summary

| Task | What it builds |
|------|---------------|
| 1 | Settings table migration, refactored migration runner |
| 2 | Signal register/verify/status API endpoints |
| 3 | Fix SignalService to use correct v1 API with sender number |
| 4 | Signal setup UI with guided phone verification |
| 5 | Signal status indicator on session page |
