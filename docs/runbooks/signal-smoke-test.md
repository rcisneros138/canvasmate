# Signal end-to-end smoke test

**Status: UNVERIFIED — first execution pending (YYYY-MM-DD)**

This runbook proves the Signal integration works end-to-end against a real
`signal-cli-rest-api` instance. Every step has explicit commands and expected
outputs so the result is reproducible.

## 1. Prerequisites

- A burner phone number that can receive **SMS or voice** in E.164 format
  (e.g. `+15551234567`).
  - **Strongly prefer a fresh number with no prior Signal account.**
    Re-registering a number that already has Signal **invalidates the existing
    account**: messages, contacts, and groups on the old install are detached.
    Do not use your personal number. Do not use a colleague's number.
  - For ranked options (prepaid SIM, org-issued line, Google Voice, etc.), see
    [Choosing a Signal number for the bot](../deploy.md#3-choosing-a-signal-number-for-the-bot)
    in the deploy guide.
- Working Docker stack per [`docs/deploy.md`](../deploy.md): Docker Engine 24+,
  Compose v2, ports `3000` and `8080` free.
- A real phone with the Signal app installed for the QR scan in step 7
  (signed into a *different* Signal account than the burner).
- Shell access on the host running Docker.

## 2. Setup: clean stack

From the repo root, wipe both volumes and rebuild:

```bash
docker compose down -v
docker compose up -d --build
```

Confirm:

```bash
docker compose ps
curl http://localhost:3000/api/health
# {"status":"ok"}
curl http://localhost:8080/v1/about
# {"versions":["v1","v2"], ...}
```

In a browser at `http://localhost:3000`:

1. Register an organizer at `/register`, then log in.
2. Create a session named exactly `Smoke Test` with two list numbers
   (e.g. `101`, `102`).

## 3. Register Signal

1. Go to `http://localhost:3000/settings/signal`.
2. Enter the burner number in E.164 and submit.
3. **Expected:** the form advances to the code-entry step with no error.
4. **Expected SMS arrival:** within ~60 seconds. If nothing arrives in 2
   minutes, see section 9 — almost always CAPTCHA. Upstream doc:
   [bbernhard register-a-number](https://github.com/bbernhard/signal-cli-rest-api#register-a-number).
5. Enter the code (`123-456` or `123456`) and submit.
6. **Expected:** green "Connected" panel with the burner number.

## 4. Verify Signal account is registered

```bash
curl http://localhost:8080/v1/accounts
# ["+15551234567"]
```

The burner must appear. Then check the daemon picked up the registration:

```bash
docker compose logs signal --tail 50
```

Look for `register` / `verify` lines for the burner with no nearby `ERROR`.

Confirm the app persisted the number:

```bash
docker compose exec app sqlite3 /app/data/canvasmate.db \
  "SELECT key, value FROM settings WHERE key = 'signal_number';"
# signal_number|+15551234567
```

## 5. Lock the session

In the organizer UI for `Smoke Test`:

1. Open `/join/<sessionId>` in a second incognito window and check in two
   test canvassers (you'll need them assigned for the lock to be meaningful).
2. On the assignment board, drag at least one canvasser into each list.
3. Click **Lock**.

Tail the app logs while you click:

```bash
docker compose logs app --tail 30 -f
```

**Expected:** `POST /api/sessions/<id>/lock 200`. No 500s. `lock.ts` iterates
groups and calls `signal.createGroup(\`${session.name} - ${group.name}\`, senderNumber)`
for each.

## 6. Inspect group creation

Ask the bridge what groups the burner owns:

```bash
curl "http://localhost:8080/v1/groups/+15551234567" | jq
```

Expected: a JSON array with two entries (`Smoke Test - 101`, `Smoke Test - 102`)
each carrying a non-null invite link. The current bbernhard swagger spec uses
`invite_link`; `groupInviteLink` and `link` are retained as legacy fallbacks
in `signal.ts` (see section 9).

To inspect a single group directly (mirrors what the code does after
`createGroup` returns an id):

```bash
curl "http://localhost:8080/v1/groups/+15551234567/<groupId>" | jq .invite_link
```

Confirm the link round-tripped into the app DB:

```bash
docker compose exec app sqlite3 /app/data/canvasmate.db \
  "SELECT name, signal_group_link FROM groups;"
# 101|https://signal.group/#CjQK...
# 102|https://signal.group/#CjQK...
```

Both rows must have a non-null `signal_group_link`. `signal.ts:createGroup`
first checks the POST response for `invite_link || groupInviteLink || link`,
and if none are present, follows up with `GET /v1/groups/{number}/{groupId}`
and reads the same fallback chain off the details payload. A null in the DB
after lock is therefore most likely a real bridge bug (group created without a
link, or detail endpoint returning an unexpected shape) rather than a
field-name mismatch.

## 7. Verify QR codes for canvassers

1. From the assignment board, confirm a canvasser is assigned to a list.
2. After lock, that canvasser's `/join/<sessionId>` view should render a QR
   code (`qrcode.react` in `client/src/pages/CanvasserView.tsx`) plus a
   tappable fallback link, both pointing at `signal_group_link`.
3. On a phone signed into a different Signal account, scan the QR (or open
   the fallback link in mobile Safari/Chrome). Tap **Join group**.
4. **Expected:** Signal opens the group; the device joins as a member.

## 8. Recording results

Operator fills this in on the PR or issue closing the runbook:

- [ ] Burner number used: `+______________`
- [ ] Time from `/api/signal/register` submit to SMS arrival: `____ s`
- [ ] `POST /v1/register/{number}` HTTP status: `____`
- [ ] `POST /v1/register/{number}/verify/{code}` HTTP status: `____`
- [ ] `GET /v1/accounts` returned the burner: yes / no
- [ ] `POST /v1/groups/{senderNumber}` HTTP status: `____`
- [ ] `groups.signal_group_link` non-null for every locked list: yes / no
- [ ] QR code renders on `/join/<sessionId>` after lock: yes / no
- [ ] QR scan from a separate phone joins the Signal group: yes / no
- [ ] Unexpected logs (paste excerpts): _____

## 9. Likely failure modes and fixes

### `402` or `403` on `POST /v1/register`

**Symptom:** bridge logs `Captcha required`; UI shows raw error.
**Fix:** solve a CAPTCHA at
`https://signalcaptchas.org/registration/generate.html`, extract the
`signalcaptcha://...` token, and re-register out-of-band:

```bash
curl -X POST "http://localhost:8080/v1/register/+15551234567" \
  -H "Content-Type: application/json" \
  -d '{"captcha":"signalcaptcha://...","use_voice":false}'
```

Procedure:
[bbernhard register-a-number](https://github.com/bbernhard/signal-cli-rest-api#register-a-number).
The verify code can still be entered through the UI afterwards.

### `register` returns `400` / no SMS / `Missing endpoint`

**Symptom:** the bridge accepts the request but signal-cli never sends SMS;
logs mention RPC errors or "endpoint not available in this mode".
**Fix:** `docker-compose.yml` now defaults to `MODE=normal` per the bbernhard
swagger spec, which is what registration expects. If you previously switched
to `MODE=json-rpc` to enable messaging features and registration broke,
revert to `MODE=normal` for the registration flow:

```yaml
  signal:
    environment:
      - MODE=normal
```

Then `docker compose up -d signal`. The bbernhard README is authoritative on
mode/endpoint compatibility.

### `createGroup` returns null link

**Symptom:** lock succeeds, but `signal_group_link` is null in the DB even
though `GET /v1/groups/{senderNumber}` shows the group.
**Fix:** `signal.ts:createGroup` already matches the current swagger payload
shape and follows the create POST with a GET to read `invite_link`. A null
link at runtime is therefore most likely a real bridge bug (group created
without a link enabled, or version drift in the response field names).
Probe the raw response:

```bash
curl -X POST "http://localhost:8080/v1/groups/+15551234567" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "shape-probe",
    "members": [],
    "permissions": { "add_members": "every-member", "edit_group": "only-admins" },
    "group_link": "enabled"
  }' | jq
```

If the POST returns only `{ "id": "..." }`, follow up with
`curl "http://localhost:8080/v1/groups/+15551234567/<id>" | jq` and confirm
`invite_link` is populated. If the bridge emits a link under some other
field name, file an issue and extend the fallback chain in
`signal.ts:createGroup` (currently `invite_link || groupInviteLink || link`).

### QR scan does not open Signal

**Symptom:** scanning opens `signal.group/#...` in the browser but Signal
never launches, or Signal says "Invalid group link".
**Fix:** verify the link stored in the DB starts with `https://signal.group/#`
and has a long base64 payload after `#`. Cross-check against section 6's
output. Anything else (a localhost URL, empty string) means the lock route
saved the wrong field.

## 10. After verification

Once every item in section 8 is checked yes:

1. Update the **Status** line at the top of this file to
   `Status: VERIFIED YYYY-MM-DD by <operator-name>`.
2. File issues or commits for any bug uncovered, citing the exact failing
   command and log excerpt. Reference this runbook in the issue body.
3. If you had to change `MODE`, the `permissions` value, or the response-link
   field, those fixes belong in code — not just in this runbook.
