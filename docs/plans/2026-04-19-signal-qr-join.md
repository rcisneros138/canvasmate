# Signal QR Join Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** After locking a session, create Signal groups (without adding members) and display invite links as QR codes on each canvasser's phone so they can join voluntarily.

**Architecture:** Modify `createGroup` to accept an empty members array. Update lock router to create groups for all groups regardless of phone numbers. Broadcast Signal links to canvassers via WebSocket. Update the canvasser view to render Signal invite links as QR codes using the existing `qrcode.react` dependency.

**Tech Stack:** Express, ws, React, qrcode.react (already installed)

---

## Task 1: Update SignalService and Lock Router

**Files:**
- Modify: `server/services/signal.ts`
- Modify: `server/services/signal.test.ts`
- Modify: `server/routes/lock.ts`

**Step 1: Update createGroup to not require members**

In `server/services/signal.ts`, the `createGroup` method currently requires a `members` array. Update it so members is optional (defaults to empty array). The signal-cli API will create the group with just the organizer and generate an invite link.

Change the signature:
```typescript
async createGroup(name: string, senderNumber: string, members: string[] = []): Promise<{ link: string | null }>
```

Note: the parameter order changes — `senderNumber` moves before `members` since members is now optional.

Body should still pass members (empty array is fine):
```typescript
body: JSON.stringify({
  name,
  members,
  permissions: { addMembers: 'everyone', editGroup: 'only-admins' },
  groupLinkState: 'enabled',
}),
```

Note: `addMembers` changed from `'only-admins'` to `'everyone'` so that canvassers who join via link can be full members.

**Step 2: Update signal.test.ts**

Update the existing `createGroup` tests to use the new parameter order `(name, senderNumber, members)`. Add a test for creating a group with no members:

```typescript
it('creates a group with no members', async () => {
  const mockFetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ link: 'https://signal.group/#xyz' }),
  });

  const signal = new SignalService('http://localhost:8080', mockFetch as any);
  const result = await signal.createGroup('Empty Group', '+15559999999');

  expect(result.link).toBe('https://signal.group/#xyz');
});
```

**Step 3: Update lock.ts**

The lock router currently skips groups where no canvassers have phone numbers. Change it to create Signal groups for ALL groups regardless of member phones:

```typescript
router.post('/:sessionId/lock', async (req, res) => {
  const { sessionId } = req.params;
  db.prepare("UPDATE sessions SET status = 'locked' WHERE id = ?").run(sessionId);

  const signalRow = db.prepare("SELECT value FROM settings WHERE key = 'signal_number'").get() as any;
  const senderNumber = signalRow?.value;

  if (senderNumber) {
    const groups = db.prepare('SELECT * FROM groups WHERE session_id = ?').all(sessionId) as any[];
    const session = db.prepare('SELECT name FROM sessions WHERE id = ?').get(sessionId) as any;

    for (const group of groups) {
      const result = await signal.createGroup(`${session.name} - ${group.name}`, senderNumber);
      if (result.link) {
        db.prepare('UPDATE groups SET signal_group_link = ? WHERE id = ?').run(result.link, group.id);
      }
    }
  }

  broadcast(sessionId, { type: 'session_locked' });
  res.json({ status: 'locked' });
});
```

**Step 4: Run all server tests**

Run: `cd server && npx vitest run`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add server/services/signal.ts server/services/signal.test.ts server/routes/lock.ts
git commit -m "feat: create Signal groups without members, generate invite links for all groups"
```

---

## Task 2: Include Signal Links in Session and Broadcast

**Files:**
- Modify: `server/routes/lock.ts`

The lock router already broadcasts `{ type: 'session_locked' }`. Enhance it to also include the group signal links in the broadcast so canvasser views can update in real time:

**Step 1: Update the broadcast payload**

After creating all Signal groups, query the updated groups and include them in the broadcast:

```typescript
// After the Signal group creation loop:
const updatedGroups = db.prepare('SELECT * FROM groups WHERE session_id = ?').all(sessionId);
broadcast(sessionId, { type: 'session_locked', groups: updatedGroups });
```

**Step 2: Also update the session GET endpoint to include group_lists with signal links**

This is already done — the GET /api/sessions/:id endpoint returns groups with `signal_group_link`. No change needed.

**Step 3: Commit**

```bash
git add server/routes/lock.ts
git commit -m "feat: broadcast Signal group links on session lock"
```

---

## Task 3: Show Signal QR Code in Canvasser View

**Files:**
- Modify: `client/src/pages/CanvasserView.tsx`
- Modify: `client/src/pages/CanvasserView.test.tsx`

**Step 1: Write the failing test**

Add a test to `client/src/pages/CanvasserView.test.tsx`:

```typescript
it('shows Signal QR code when signal link is present', () => {
  render(
    <CanvasserView
      sessionId="test"
      sessionToken="tok"
      assignment={{
        listNumber: '4821093',
        groupName: 'Team A',
        members: ['Alice', 'Bob'],
        signalLink: 'https://signal.group/#abc123',
      }}
    />
  );
  expect(screen.getByText('Join Signal Group')).toBeDefined();
  // QR code SVG should be present
  const svg = document.querySelector('svg');
  expect(svg).toBeDefined();
});
```

**Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/pages/CanvasserView.test.tsx`

**Step 3: Update CanvasserView to show QR code**

In `client/src/pages/CanvasserView.tsx`, import QRCodeSVG and render it when `signalLink` is present:

```tsx
import { QRCodeSVG } from 'qrcode.react';
```

Replace the existing signal link section (the `<a>` tag) with:

```tsx
{assignment.signalLink && (
  <div className="flex flex-col items-center space-y-3">
    <QRCodeSVG value={assignment.signalLink} size={200} level="M" />
    <a
      href={assignment.signalLink}
      className="px-6 py-3 bg-blue-600 text-white rounded-lg font-bold"
    >
      Join Signal Group
    </a>
    <p className="text-xs text-gray-400">Scan QR code or tap the button</p>
  </div>
)}
```

**Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/pages/CanvasserView.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add client/src/pages/CanvasserView.tsx client/src/pages/CanvasserView.test.tsx
git commit -m "feat: show Signal group invite as QR code on canvasser view"
```

---

## Task 4: Wire Signal Links into Canvasser Flow

**Files:**
- Modify: `client/src/pages/JoinPage.tsx`

Currently `JoinPage` passes `assignment={null}` to `CanvasserView`. After lock, the canvasser needs to see their assignment including the Signal link. Update `JoinPage` to fetch the canvasser's assignment after check-in and listen for lock events via WebSocket.

**Step 1: Update JoinPage**

```tsx
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import CheckIn from './CheckIn';
import CanvasserView from './CanvasserView';

export default function JoinPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [assignment, setAssignment] = useState<any>(null);

  // Poll for assignment after check-in
  useEffect(() => {
    if (!sessionToken || !sessionId) return;

    const interval = setInterval(async () => {
      const res = await fetch(`/api/sessions/${sessionId}`);
      if (!res.ok) return;
      const session = await res.json();

      // Find this canvasser by token
      const canvasser = session.canvassers.find((c: any) => c.session_token === sessionToken);
      if (!canvasser || !canvasser.group_id) return;

      // Find the group and its signal link
      const group = session.groups.find((g: any) => g.id === canvasser.group_id);
      if (!group) return;

      // Find the list via groupLists
      const groupList = session.groupLists?.find((gl: any) => gl.group_id === group.id);
      const list = groupList ? session.lists.find((l: any) => l.id === groupList.list_id) : null;

      // Find group members
      const members = session.canvassers
        .filter((c: any) => c.group_id === group.id)
        .map((c: any) => c.display_name);

      setAssignment({
        listNumber: list?.list_number || 'TBD',
        groupName: group.name,
        members,
        signalLink: group.signal_group_link || undefined,
      });

      clearInterval(interval);
    }, 3000);

    return () => clearInterval(interval);
  }, [sessionToken, sessionId]);

  if (!sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-600">Invalid session link</p>
      </div>
    );
  }

  if (!sessionToken) {
    return (
      <CheckIn
        sessionId={sessionId}
        onCheckedIn={(token) => setSessionToken(token)}
      />
    );
  }

  return (
    <CanvasserView
      sessionId={sessionId}
      sessionToken={sessionToken}
      assignment={assignment}
    />
  );
}
```

This polls every 3 seconds after check-in to detect when the canvasser gets assigned and when the session is locked (Signal links appear).

**Step 2: Commit**

```bash
git add client/src/pages/JoinPage.tsx
git commit -m "feat: poll for assignment and Signal link after canvasser check-in"
```

---

## Summary

| Task | What it builds |
|------|---------------|
| 1 | Update SignalService to create groups without members, fix lock router |
| 2 | Broadcast Signal links on lock |
| 3 | QR code + link in canvasser view |
| 4 | Wire assignment + Signal link polling into join flow |
