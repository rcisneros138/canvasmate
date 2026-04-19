# CanvasMate v1 Design

An open-source PWA that streamlines canvass event launches for political organizers.

## Problem

Canvass organizers manually manage list assignment via spreadsheets and whiteboards, verbally tell canvassers their MiniVAN list numbers, and manually create Signal groups for session communication. This is slow, error-prone, and creates friction at every canvass launch.

## Solution

A mobile-first web app where:
- Organizers upload list numbers and create a session
- Canvassers check in via QR code on their phone
- Organizers assign canvassers to lists/groups via a projected drag-and-drop interface
- Canvassers see their assignment in real time on their phone
- Signal groups are auto-created for session communication

## User Roles

- **Organizer** — creates sessions, assigns lists, shares screen
- **Canvasser** — checks in, receives assignment
- **Group Lead** (optional) — canvasser responsible for a small team

## Event Flow

1. **Organizer creates a session** — names it, uploads list numbers (txt file with one number per line, or CSV)
2. **Canvassers check in** — scan a QR code projected on screen or follow a short link. Enter display name. Optionally provide phone number (for Signal auto-add) or MiniVAN ID.
3. **Organizer assigns lists** — on the projected screen, drags canvassers into groups/lists. Everyone sees it happen live.
4. **Assignments lock** — canvassers see their list number on their phone (big, prominent, with a "Copy" button for pasting into MiniVAN). Signal groups are created.
5. **Session ends** — PII is purged after configurable window (default 24h).

## Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Frontend | React + TypeScript + Tailwind CSS (PWA) | Works on any device, no app store |
| Backend | Node.js (Express or Fastify) | Simple, well-known, good WebSocket support |
| Real-time | WebSockets | Canvassers see assignments instantly |
| Database | SQLite (better-sqlite3 or Turso) | Single-file DB, trivial to self-host |
| Signal | signal-cli (sidecar daemon) | Mature CLI for Signal automation |
| Deployment | Single Docker container | One command to run |

## Data Model

```
Session
├── id (random short code, e.g., "SAT-W5")
├── name
├── created_at
├── expires_at (default 24h after creation)
├── organizer_id (FK)
├── status (setup | active | locked | closed)
│
├── Lists[]
│   ├── list_number (string, e.g., "4821093")
│   └── label (optional)
│
├── Groups[]
│   ├── name
│   ├── list_ids[]
│   └── signal_group_link (generated after lock)
│
└── Canvassers[]
    ├── display_name
    ├── phone (optional)
    ├── minivan_id (optional)
    ├── group_id (null until assigned)
    └── session_token (ephemeral)
```

## Session Lifecycle

| Phase | State |
|-------|-------|
| Organizer uploads lists, names session | `setup` |
| QR code goes live, canvassers check in, organizer assigns | `active` |
| Assignments finalized, Signal groups created | `locked` |
| Session ends, PII purged | `closed` |

## Assignment UX (Projected Screen)

**Left side:** Unassigned canvassers (names appear live as people check in)

**Right side:** Groups/Lists as columns or cards

**Interactions:**
- Drag & drop canvassers into groups/lists
- Multi-select + "Create group" for quick grouping
- "Distribute evenly" button for auto-assignment
- Solo canvassers drag directly onto a list (no group needed)

## Canvasser Phone View

- While unassigned: "Checked in! Waiting for assignment..."
- Once assigned: List number (large), group members' names, "Copy list #" button
- After lock: Signal group invite link (if they provided phone, they're auto-added)

## Signal Integration

- Runs signal-cli as a sidecar, registered to a dedicated bot phone number
- On lock: creates a Signal group per group, auto-adds canvassers who provided phone numbers
- Canvassers without phone numbers see a join link on their phone screen (they can tap it or skip)
- Messages set to disappear after 24h
- Rate-limited group creation to avoid Signal throttling

## Data Minimization & Privacy

**Purged after session expiry (default 24h):**
- Canvasser names, phone numbers, session tokens, Signal group links

**Retained:**
- Session name, date, attendance count, number of lists used

No long-term PII storage. Organizer accounts are the only persistent data.

## Deployment

```bash
docker run -d -p 3000:3000 -v canvasmate-data:/data canvasmate/canvasmate:latest
```

**First-run setup:**
1. Organizer creates account
2. Optionally registers Signal bot number (guided SMS verification flow)

**One-click deploy templates** provided for Railway, Fly.io, Render.

## Scope Boundaries (v1)

**In scope:**
- Session creation (upload list numbers via txt/csv)
- QR code check-in
- Real-time drag-and-drop assignment
- Canvasser phone view with list number
- Signal group auto-creation
- Auto-purge of PII

**Out of scope:**
- VAN/VoteBuilder API integration (access too restricted)
- Analytics dashboard
- Canvass result tracking (MiniVAN handles this)
- Native mobile apps
