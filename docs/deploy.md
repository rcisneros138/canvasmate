# Self-hosting CanvasMate

This guide is for sysadmins running CanvasMate for their own canvass team. The
stack is two Docker containers: the app (Express + built client) and a Signal
bridge ([bbernhard/signal-cli-rest-api](https://github.com/bbernhard/signal-cli-rest-api)).

## 1. Prerequisites

- Docker Engine 24+ with the Compose v2 plugin (`docker compose ...`).
- A phone number that can receive SMS (or voice) for Signal registration.
  Signal sometimes requires a CAPTCHA solve before sending verification SMS;
  see the
  [signal-cli-rest-api docs](https://github.com/bbernhard/signal-cli-rest-api#register-a-number)
  for the current workaround.
- A host with a public hostname if you want canvassers to join from their phones
  (a reverse proxy with TLS is required for camera access from QR scans on most
  mobile browsers).

## 2. Quick start

```bash
git clone https://github.com/your-org/canvasmate.git
cd canvasmate
docker compose up -d
```

Verify the app is up:

```bash
curl http://localhost:3000/api/health
# {"status":"ok"}
```

The Signal bridge listens on port 8080 inside the compose network and is
reachable from the host at `http://localhost:8080` for debugging.

## 3. First-run setup

Open `http://localhost:3000` in a browser and:

1. Register an organizer account. The first call hits
   `POST /api/auth/register` with `{ email, password }`. There is no email
   verification; the first account you create is just an organizer login.
2. Log in with the credentials you just registered.
3. Go to `/settings/signal` and enter the phone number you want CanvasMate to
   use. Format it in E.164 (`+15551234567`).
4. Watch that phone for an SMS verification code. Enter it on the same page.
5. Once `/settings/signal` shows `configured`, you can create sessions and the
   app will create per-session Signal groups on lock.

If the phone never gets the SMS, see the troubleshooting section below.

## 4. Persisting data

Two named volumes are declared in `docker-compose.yml`:

| Volume                       | Container path                       | Contents                                 |
| ---------------------------- | ------------------------------------ | ---------------------------------------- |
| `canvasmate_canvasmate-data` | `/app/data`                          | SQLite DB at `/app/data/canvasmate.db`   |
| `canvasmate_signal-data`     | `/home/.local/share/signal-cli`      | signal-cli state (registration, keys)    |

The volume names are prefixed with the compose project name (`canvasmate` by
default, taken from the directory name). Adjust commands below if you renamed
the project.

PII (names, addresses, phone numbers tied to canvassers) auto-purges when a
session expires. The cleanup job runs every hour in-process and deletes
sessions where `expires_at < now`. Migrations and the organizer table are
persistent.

## 5. Reverse proxy and TLS

The app speaks plain HTTP on port 3000 and accepts WebSocket upgrades at
`/ws/session/:id`. Your reverse proxy must forward both.

### Caddy

```caddy
canvasmate.example.org {
  reverse_proxy localhost:3000
}
```

Caddy auto-detects WebSocket upgrades, so no extra directives are needed. TLS
is automatic via Let's Encrypt.

### nginx

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

    # WebSocket upgrade for /ws/session/:id
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 3600s;
  }
}
```

The `Upgrade`/`Connection` headers are required or the join page will fall
back to disconnect-reconnect loops on every assignment update.

## 6. Backups

Most user-facing data purges hourly, so backups are mostly migrations and
organizer credentials. Snapshot the SQLite volume:

```bash
docker run --rm \
  -v canvasmate_canvasmate-data:/data \
  -v "$(pwd)":/backup \
  alpine tar czf /backup/canvasmate-backup.tar.gz /data
```

Restore by extracting the archive back into the volume:

```bash
docker compose down
docker run --rm \
  -v canvasmate_canvasmate-data:/data \
  -v "$(pwd)":/backup \
  alpine sh -c "cd / && tar xzf /backup/canvasmate-backup.tar.gz"
docker compose up -d
```

The Signal volume contains private keys for the registered number. Back it up
the same way (`canvasmate_signal-data`) if you want to avoid re-registering on
host migration. Treat it as sensitive.

## 7. Updating

```bash
git pull
docker compose up -d --build
```

The app container runs migrations on startup. No manual step is needed unless
release notes say so.

## 8. Resetting Signal

To force re-registration of the Signal number without losing app data:

```bash
docker compose down
docker volume rm canvasmate_signal-data
docker compose up -d
```

Then re-run `/settings/signal` from the UI.

To wipe everything (Signal state and the app database):

```bash
docker compose down -v
docker compose up -d
```

`down -v` removes both named volumes. You will be back at first-run setup.

## 9. Troubleshooting

### Signal SMS never arrives

The bbernhard image refuses some registrations until a CAPTCHA token is
provided. Follow the
[CAPTCHA workaround](https://github.com/bbernhard/signal-cli-rest-api#register-a-number)
upstream. You can hit the bridge directly to retry:

```bash
curl -X POST "http://localhost:8080/v1/register/+15551234567" \
  -H "Content-Type: application/json" \
  -d '{"captcha":"signalcaptcha://..."}'
```

Check the bridge logs while debugging:

```bash
docker compose logs -f signal
```

### `/api/health` works but `/` returns 404

The static client fallback is gated on `existsSync('client/dist')`. If the
build step was skipped or `client/dist` was not copied into the runtime image,
only the API responds. Rebuild from a clean state:

```bash
docker compose build --no-cache app
docker compose up -d
```

Confirm `client/dist/index.html` exists inside the container:

```bash
docker compose exec app ls /app/client/dist
```

### WebSocket disconnects under a reverse proxy

CanvasMate uses `/ws/session/:id` for live assignment updates. Disconnect
loops on the join page almost always mean the proxy is not forwarding the
`Upgrade` and `Connection` headers, or it is closing idle connections too
aggressively. For nginx, confirm the headers from the example above are
present and bump `proxy_read_timeout`. For Cloudflare or similar, ensure
WebSockets are enabled for the hostname.

### Port conflicts

Both `3000` (app) and `8080` (signal) are published to the host by default.
Edit the `ports:` section in `docker-compose.yml` to remap them, or remove
the published ports for `signal` entirely if only the app needs to reach it
(it talks over the compose-internal `http://signal:8080`).

### Database locked errors

SQLite serializes writes. If you see `SQLITE_BUSY` in app logs under heavy
load, cap the proxy connection count or move to a dedicated host. CanvasMate
is sized for a single canvass at a time, not a national rollout.
