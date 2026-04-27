import { describe, it, expect, inject } from 'vitest';

const BASE = inject('baseUrl');
if (!BASE) throw new Error('BASE_URL must be set (globalSetup should set it)');

/**
 * End-to-end integration test for the full canvass flow.
 *
 * The Express app is booted in-process by `e2e/globalSetup.ts`,
 * which exposes the listening URL via `inject('baseUrl')`. No
 * separate `npm run dev:server` is required.
 *
 * Run: `npm run test:e2e`
 */
describe('full canvass flow', () => {
  it('creates session, fetches it, and locks it', async () => {
    // 1. Create session
    const session = await fetch(`${BASE}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'E2E Test',
        listNumbers: '111\n222',
        organizerId: 'org-1',
      }),
    }).then((r) => r.json());

    expect(session.id).toBeDefined();
    expect(session.name).toBe('E2E Test');
    expect(session.status).toBe('setup');
    expect(session.lists).toHaveLength(2);

    // 2. Fetch the session back and verify it persisted
    const fetched = await fetch(`${BASE}/api/sessions/${session.id}`).then(
      (r) => r.json(),
    );

    expect(fetched.name).toBe('E2E Test');
    expect(fetched.lists).toHaveLength(2);
    expect(fetched.lists[0].list_number).toBe('111');
    expect(fetched.lists[1].list_number).toBe('222');
    expect(fetched.groups).toEqual([]);
    expect(fetched.canvassers).toEqual([]);

    // 3. Lock the session
    const lock = await fetch(`${BASE}/api/sessions/${session.id}/lock`, {
      method: 'POST',
    }).then((r) => r.json());

    expect(lock.status).toBe('locked');

    // 4. Confirm the session is now locked
    const after = await fetch(`${BASE}/api/sessions/${session.id}`).then(
      (r) => r.json(),
    );

    expect(after.status).toBe('locked');
  });

  it('returns 404 for a nonexistent session', async () => {
    const res = await fetch(`${BASE}/api/sessions/does-not-exist`);
    expect(res.status).toBe(404);
  });

  it('health endpoint responds ok', async () => {
    const res = await fetch(`${BASE}/api/health`).then((r) => r.json());
    expect(res.status).toBe('ok');
  });
});
