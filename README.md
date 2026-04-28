# CanvasMate

A self-hostable web app that streamlines the launch of door-to-door canvass events for political organizers and volunteer teams.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node 22+](https://img.shields.io/badge/node-22%2B-brightgreen.svg)](https://nodejs.org/)

## What problem this solves

Canvass organizers spend the first 20 minutes of every launch managing list assignments on whiteboards, calling out MiniVAN list numbers across a crowded room, and manually creating Signal groups so each canvass team can stay in touch. It is slow, error-prone, and creates avoidable friction every time a team hits the doors.

CanvasMate replaces that with a projected drag-and-drop board, a phone-friendly check-in flow, and automatic Signal group creation, so the launch takes minutes instead of half an hour.

## What it does

- Mobile-first PWA that works on any phone without an app store install.
- QR-code check-in for canvassers — scan the code on the projector, type a name, optionally drop a phone number.
- Drag-and-drop assignment board for the organizer's projected screen, with live updates as people check in.
- Real-time push to canvasser phones over WebSockets when their assignment changes.
- One-tap copy of the MiniVAN list number on each canvasser's phone.
- Per-group Signal group creation on lock, with a tappable invite link and QR code shown on the canvasser view.
- PII auto-purges on a configurable window (default 24 hours after session expiry) — names, phone numbers, and Signal links all go.

## How it works (event flow)

1. The organizer creates a session, names it, and uploads list numbers (a TXT file with one number per line, or a CSV).
2. A QR code goes up on the projector. Canvassers scan it, enter a display name, and optionally provide a phone number for Signal auto-add.
3. As people check in, they appear on the organizer's assignment board. The organizer drags canvassers onto lists or groups, and canvassers see their assignment update live on their phones.
4. The organizer locks the session. Each group gets a Signal group created automatically; canvassers see the join link and a QR code on their phones.
5. The session expires (default 24 hours). The hourly cleanup job deletes the session, all canvasser PII, and all Signal links.

## Screenshots / demo

Screenshots coming soon. If you run an instance and want to contribute screenshots of the organizer board, the canvasser view, and the Signal join screen, please open a PR.

## Quick start (Docker)

The fastest way to try CanvasMate is the bundled Docker Compose stack, which runs the app alongside a [signal-cli-rest-api](https://github.com/bbernhard/signal-cli-rest-api) bridge.

```bash
git clone https://github.com/your-org/canvasmate.git
cd canvasmate
docker compose up -d
```

Verify the app is responding:

```bash
curl http://localhost:3000/api/health
# {"status":"ok"}
```

Open `http://localhost:3000`, register an organizer account, and (optionally) walk through `/settings/signal` to register a Signal sender number.

For a real deployment with TLS, reverse proxying, backups, and Signal troubleshooting, see [`docs/deploy.md`](docs/deploy.md).

## Local development

CanvasMate is an npm workspace with a Vite React client and an Express server.

```bash
npm install
npm run dev
```

This boots the server on `:3000` and the Vite dev server on its own port with `/api` and `/ws` proxied to the server.

Useful scripts:

```bash
npm run build              # Build client and server
npm run start              # Start production server (expects prior build)
npm test --workspace=server
npm test --workspace=client
npm run test:e2e
```

## Tech stack

| Layer       | Choice                                           |
| ----------- | ------------------------------------------------ |
| Client      | React 19, TypeScript, Tailwind CSS, Vite, PWA    |
| Drag/drop   | `@dnd-kit/core` + `@dnd-kit/sortable`            |
| QR          | `qrcode.react`                                   |
| Server      | Node.js 22, Express 5, `ws` for WebSockets       |
| Database    | SQLite via `better-sqlite3`, migrations via Umzug |
| Signal      | [bbernhard/signal-cli-rest-api](https://github.com/bbernhard/signal-cli-rest-api) sidecar |
| Packaging   | Single Docker image + Compose stack              |

## Privacy and data handling

CanvasMate handles canvasser PII (display names, optional phone numbers, optional MiniVAN IDs) and is built to forget it quickly.

- **Auto-purge.** A cleanup job (`server/services/cleanup.ts`) runs every hour and deletes any session whose `expires_at` is in the past. The default expiry is 24 hours after session creation. Deleting a session cascades to its canvassers, lists, groups, and Signal links.
- **Short-lived sessions.** Session tokens are ephemeral and tied to the session row, so they are gone after the same purge.
- **Local-only database.** SQLite lives at `/app/data/canvasmate.db` inside the container, on a single Docker volume. No data leaves your host.
- **Signal credentials.** The Signal sender number's keys live inside the `signal-cli-rest-api` sidecar's volume, encrypted at rest by signal-cli's own mechanisms. CanvasMate stores only the sender phone number itself in its settings table.
- **What is retained.** Organizer accounts (email + password hash) and high-level session metadata; no canvasser PII past the expiry window.

If you self-host, treat the `signal-data` volume as sensitive (it contains the registered number's keys) and consider tightening the default 24-hour purge window if your group's policy requires it.

## Status and known caveats

CanvasMate is at v1. The core flow — session creation, QR check-in, drag-and-drop assignment, lock, real-time updates, and PII purge — is covered by unit and end-to-end tests.

The Signal integration is wired against the current `signal-cli-rest-api` swagger spec (the lock route iterates groups and calls the bridge; the canvasser view renders the returned invite link as a QR). It has **not yet been verified end-to-end against a live Signal bridge with a registered burner number** — the runbook for that smoke test lives at [`docs/runbooks/signal-smoke-test.md`](docs/runbooks/signal-smoke-test.md) and is the recommended first thing to run before relying on Signal at a real canvass.

## Contributing

Contributions are welcome — both code and field reports from organizers who run it at a launch.

If you are filing a code change, please:

1. Open an issue describing the bug or feature first if it is non-trivial.
2. Run the relevant test suites locally before opening a PR:
   ```bash
   npm test --workspace=server
   npm test --workspace=client
   npm run test:e2e
   ```
3. Reference [`docs/plans/2026-04-19-canvasmate-v1-design.md`](docs/plans/2026-04-19-canvasmate-v1-design.md) for the original design intent (problem statement, user roles, data model, scope boundaries). Note that plan files are gitignored going forward, but the v1 design doc is the canonical reference for current behavior.

## License

CanvasMate is released under the MIT License. See [`LICENSE`](LICENSE) for the full text.

## Acknowledgments

- [bbernhard/signal-cli-rest-api](https://github.com/bbernhard/signal-cli-rest-api) — the upstream Signal HTTP bridge that makes the Signal integration feasible.
- The political-organizing community whose recurring "I just want a list and a Signal group" frustration was the original prompt for this project.
