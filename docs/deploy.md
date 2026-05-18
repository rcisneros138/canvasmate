# Deploying CanvasMate

CanvasMate is a single-process Node app (Express + built React client + SQLite
+ WebSockets). It runs anywhere that speaks Docker. The recommended path is
**Fly.io for hosting + Cloudflare for DNS / Turnstile + Resend for email**.

If you'd rather self-host on a VPS, jump to the [appendix](#appendix-self-hosting-on-a-vps).

---

## What you'll set up

| Piece                  | Provider                  | Cost                  |
| ---------------------- | ------------------------- | --------------------- |
| App hosting            | Fly.io                    | $0–5/mo (small VM)    |
| Domain                 | Cloudflare Registrar      | ~$10/yr               |
| DNS                    | Cloudflare DNS            | Free                  |
| Transactional email    | Resend                    | Free up to 3k emails  |
| Bot guard (CAPTCHA)    | Cloudflare Turnstile      | Free                  |
| Persistent storage     | Fly volume                | Included              |

Total: about $10/yr while small.

---

## 1. Prerequisites

- A computer with [`flyctl`](https://fly.io/docs/hands-on/install-flyctl/) installed and `fly auth login` completed.
- A Cloudflare account (for the domain + DNS + Turnstile).
- A Resend account.
- This repo cloned locally.

## 2. Register a domain

Either:

- **Cloudflare Registrar** — search and buy at `dash.cloudflare.com → Domains → Register`. Cheapest (wholesale, no markup) and the DNS is already configured.
- **Anywhere else (Porkbun, Namecheap, etc.)** — register, then add the domain to Cloudflare (`dash.cloudflare.com → Add a site`), update the registrar's nameservers to the two Cloudflare nameservers Cloudflare prints. Wait a few hours for DNS to propagate.

Either way, you'll end up with the domain in Cloudflare DNS.

## 3. Configure transactional email (Resend)

1. Sign in at `resend.com`. Add your domain under `Domains → Add Domain`.
2. Resend prints three DNS records (`MX`, `TXT` for SPF, `TXT` for DKIM, optionally `TXT` for DMARC). Copy them into Cloudflare DNS (`dash.cloudflare.com → DNS → Records → Add record`). Set the proxy status to **DNS only** (grey cloud) for all email-related records.
3. Click "Verify DNS records" in Resend. It usually takes a minute or two.
4. Once verified, go to `API Keys → Create API Key`. Save the value — it starts with `re_` and is only shown once.

## 4. Configure Turnstile (Cloudflare CAPTCHA)

1. In Cloudflare dashboard → **Turnstile** → **Add site**.
2. Hostname: the production domain (e.g. `canvasmate.org`).
3. Widget mode: **Managed** (recommended — invisible most of the time).
4. After creation, copy both:
   - **Site key** (public, sent to the browser)
   - **Secret key** (private, used by the server)

## 5. Launch on Fly.io

From the repo root:

```bash
flyctl launch --no-deploy
```

When prompted:

- App name: `canvasmate` (or whatever you'd prefer — must be globally unique on Fly).
- Region: pick the one nearest your canvassers.
- Accept the existing `fly.toml` rather than letting `flyctl` regenerate it.
- Skip Postgres / Redis — we use SQLite.

Then create the volume that backs SQLite:

```bash
fly volumes create canvasmate_data --region <your-region> --size 1
```

(`--size 1` = 1 GB, more than enough for many canvasses.)

Set the secrets — these never get committed to git:

```bash
fly secrets set \
  APP_URL=https://canvasmate.org \
  RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxx \
  MAIL_FROM="CanvasMate <noreply@canvasmate.org>" \
  TURNSTILE_SECRET=0x4AAAAAAAxxxxxxxxxxxxxxxxxxxxxxxxxx \
  TURNSTILE_SITE_KEY=0x4AAAAAAAyyyyyyyyyyyyyyyyyyyyyyyyyy
```

Deploy:

```bash
fly deploy
```

When deploy finishes, `flyctl` prints a temporary `*.fly.dev` hostname. Test it:

```bash
curl https://<your-app>.fly.dev/api/health
# {"status":"ok"}
```

Open the URL in a browser, click "Host a canvass", enter your email, and check that the magic link arrives. (At first, before the custom domain is attached, the link in the email will use `*.fly.dev` — that's fine for the initial smoke test.)

## 6. Attach your custom domain

```bash
fly certs add canvasmate.org
```

Fly prints the DNS records to add (one `A`, one `AAAA`, plus an ACME challenge `_acme-challenge` `CNAME`). Add them in Cloudflare DNS. Set the proxy status to **DNS only** (grey cloud) — otherwise the ACME challenge can't reach Fly's edge.

Wait a minute, then:

```bash
fly certs check canvasmate.org
```

Once it shows `Configured: true`, update `APP_URL`:

```bash
fly secrets set APP_URL=https://canvasmate.org
```

That re-rolls the app and magic-link emails now point at your real domain.

## 7. Smoke test the whole flow

1. Open `https://canvasmate.org`. You should see the Host/Join split landing.
2. Click "Start a session" → email yourself a magic link → click it → you should land on `/session/new` signed in.
3. Create a session with a few list numbers. Confirm it shows up on the homepage.
4. From a different browser (or incognito), open `https://canvasmate.org` again. Click "Continue" with the new session's join code. Check in as a canvasser. The organizer's assignment board should show the new check-in within a second over WebSocket.
5. Lock the session. The canvasser's screen should switch to the "list number" view.

If anything stalls, check `fly logs` first.

---

## Routine operations

### Updating

```bash
git pull
fly deploy
```

The container runs DB migrations on startup. No manual step needed.

### Reading logs

```bash
fly logs
```

### Connecting to the SQLite DB

```bash
fly ssh console
sqlite3 /app/data/canvasmate.db
```

### Rotating secrets

```bash
fly secrets set RESEND_API_KEY=re_new_value...
```

Fly redeploys automatically after `fly secrets set`.

### Backups

The SQLite file lives at `/app/data/canvasmate.db` on the Fly volume. Most user-facing data auto-purges hourly when sessions expire, but you should still snapshot organizer accounts:

```bash
fly ssh sftp shell
get /app/data/canvasmate.db
```

For automated backups, the simplest path is a [Litestream](https://litestream.io/) sidecar streaming to S3 / B2. Out of scope for this guide.

### Scaling

- Idle? Fly stops the machine after a few minutes of zero traffic — first request after that takes a couple seconds to wake. Flip `auto_stop_machines = false` in `fly.toml` if zero cold starts matter more than the few extra dollars.
- Heavier load? Bump `[[vm]] cpus` and `memory_mb` in `fly.toml`. SQLite is single-writer, so vertical scaling buys you a lot before you'd need to think about Postgres.

---

## Appendix: self-hosting on a VPS

If you'd rather run on a server you own (Hetzner, Vultr, your own box), the
existing Docker Compose setup still works.

### Prerequisites

- Docker Engine 24+ with the Compose v2 plugin (`docker compose ...`).
- A host with a public hostname so canvassers can join from phones.
- Same Resend / Turnstile setup as steps 3–4 above.

### Run

```bash
git clone https://github.com/your-org/canvasmate.git
cd canvasmate
cp .env.example .env
# edit .env with your secrets
docker compose --env-file .env up -d
```

Verify:

```bash
curl http://localhost:3000/api/health
# {"status":"ok"}
```

### TLS via Caddy

Put Caddy in front of the app container. The app speaks plain HTTP on
port 3000 and accepts WebSocket upgrades at `/ws/session/:id`.

```caddy
canvasmate.example.org {
  reverse_proxy localhost:3000
}
```

Caddy auto-detects WebSocket upgrades and handles Let's Encrypt automatically.

Set `TRUST_PROXY=true` in `.env` so `req.ip` follows `X-Forwarded-For` for
rate-limiting.

### TLS via nginx

```nginx
server {
  listen 443 ssl http2;
  server_name canvasmate.example.org;

  ssl_certificate     /etc/letsencrypt/live/canvasmate.example.org/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/canvasmate.example.org/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 3600s;
  }
}
```

The `Upgrade`/`Connection` headers are required or the assignment board will
fall back to disconnect-reconnect loops on every update.

### Persisting data

One named volume is declared in `docker-compose.yml`:

| Volume                       | Container path | Contents                                |
| ---------------------------- | -------------- | --------------------------------------- |
| `canvasmate_canvasmate-data` | `/app/data`    | SQLite DB at `/app/data/canvasmate.db`  |

Snapshot:

```bash
docker run --rm \
  -v canvasmate_canvasmate-data:/data \
  -v "$(pwd)":/backup \
  alpine tar czf /backup/canvasmate-backup.tar.gz /data
```

Restore:

```bash
docker compose down
docker run --rm \
  -v canvasmate_canvasmate-data:/data \
  -v "$(pwd)":/backup \
  alpine sh -c "cd / && tar xzf /backup/canvasmate-backup.tar.gz"
docker compose up -d
```

### Updating

```bash
git pull
docker compose up -d --build
```

---

## Troubleshooting

### `/api/health` works but `/` returns 404

The static client fallback is gated on the build output existing inside the
image. Rebuild from clean:

```bash
docker compose build --no-cache app   # self-hosted
fly deploy --no-cache                 # fly.io
```

### Magic-link emails not arriving

1. Check `fly logs` — if the server logs `[mailer:dev] Magic link for...`, `RESEND_API_KEY` isn't set.
2. Check Resend → Logs for delivery failures (most often DNS not propagated yet, or the email landed in spam).
3. Make sure `MAIL_FROM` uses a domain you've verified in Resend.

### WebSocket disconnects

The new reconnect-with-backoff in `useWebSocket` should silently recover from
single drops. If you see persistent loops, your proxy is probably stripping
`Upgrade` / `Connection` headers. See the nginx config above; Caddy and Fly
handle this automatically.

### "Too many requests" on sign-in

The rate limiter caps `POST /api/auth/request` at 5/hour + 20/day per IP. In
production behind Cloudflare, make sure `TRUST_PROXY=true` so the real IP is
used — otherwise the rate limit measures the proxy IP and everyone shares one
bucket.

### Database locked errors

SQLite serializes writes. CanvasMate is sized for a single canvass at a time,
not a national rollout. If `SQLITE_BUSY` shows up under load, scale up the VM
first; if that's not enough, the next move is a refactor to Postgres.
