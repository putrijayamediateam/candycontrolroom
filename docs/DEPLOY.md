# Hosting CANDY Control Room online (Render, Singapore)

Prepared by the Designer Team (Ryan, with Ravi and Lina) on 11 Nov 2026. **Status: prepared, not deployed.**

**Decision (AIN, 11 Nov 2026, recorded in the decisions log): hosting approved on Render Singapore at about
USD 14.55/month.** This release contains hosting only. Demo mode is not included and stays unreleased.
No account, payment, deploy or push has been made. Every step marked **AIN** needs AIN herself: accounts,
payment, and approving the monthly cost. Production deploys, paid infrastructure and credential changes
always need AIN's explicit approval.

## 1. Recommendation

**Render, Singapore region: about USD 14.55/month**, or **about USD 27.55/month** with the larger database.

| | Railway (Hobby) | **Render** | Fly.io | DigitalOcean SGP1 |
|---|---|---|---|---|
| Monthly total | est. ~$6–8 (usage-based: $5 plan includes $5 usage) | **$14.55**: Starter web $7 + Postgres basic-256mb $6 + Postgres storage ~$0.30 + 5 GB disk $1.25 (**$27.55** with basic-1gb $19) | est. ~$47.50 with Managed Postgres ($8.50 machine + $38 MPG + volume); ~$9 if you run Postgres yourself | $15.60: 2 GB Droplet $12 + daily backups $3.60, Postgres in Docker |
| Singapore | Yes | **Yes** | Yes (`sin`) | Yes (SGP1) |
| GitHub needed | No (`railway up` uploads the folder) | **For Docker builds: a Git repo** (private GitHub is simplest); or a prebuilt image | No (`fly deploy`) | No |
| Postgres backups | Volume backups (daily kept 6 days, weekly, monthly); plan coverage not stated | **Managed, point-in-time restore: 3 days (Hobby) / 7 days (Pro); restore to a new database** | Managed: "automatic backups", retention not stated | Self-run: your own `pg_dump` job |
| HTTPS | Automatic | **Automatic** | Automatic | You set up Caddy |
| Files | Volume $0.15/GB | **Disk $0.25/GB, daily snapshot kept 7 days** | Volume $0.15/GB | Droplet disk |
| Admin for AIN | Low–medium (bill varies) | **Low (fixed prices, dashboard restores)** | Medium (command line) | High (server patching, backups) |

Why Render: fixed monthly prices AIN can predict, a managed Postgres with point-in-time restore, daily disk
snapshots, automatic HTTPS and a dashboard for everything, all in Singapore. Railway is cheaper and needs no
GitHub, but its bill moves with usage and its backup coverage per plan isn't stated. DigitalOcean is cheap
but AIN would have to look after a server. Fly's managed Postgres costs about three times as much.

Sources (official pages, checked 11 Nov 2026): render.com/pricing, render.com/docs/compute-plans,
render.com/docs/disks, render.com/docs/postgresql-backups, render.com/docs/regions,
render.com/docs/deploying-an-image; railway.com/pricing, docs.railway.com/reference/backups,
docs.railway.com/reference/volumes; docs.fly.io/about/pricing, docs.fly.io/mpg/; digitalocean.com/pricing/droplets,
digitalocean.com/pricing/managed-databases. Render's workspace fee ($0 Hobby, $25 Pro) comes from a Render
article (July 2026), not the pricing page. Postgres storage minimum is not stated, so $0.30 assumes 1 GB.

Notes:
- A Render disk turns off zero-downtime deploys: each deploy has a short gap (seconds to a minute).
- Starter has 512 MB RAM. That should be enough for one user plus the 6 Claude sessions, but this is not load-tested.

## 2. What the app now supports (branch `claude/hosting`)

| Setting | Purpose |
|---|---|
| `HOST=0.0.0.0`, `PORT` | Listen publicly on the platform's port. Locally the defaults stay 127.0.0.1:3100. |
| `COOKIE_SECURE=true` | Session cookie only over HTTPS; also turns on HSTS. **The server refuses to start publicly without it.** |
| `TRUST_PROXY=1` | Trust exactly one proxy hop, so the login throttle sees the real IP (and a forged header can't dodge it). |
| `PGSSLMODE` / `?sslmode=` | `require` (TLS) or `verify-full` (TLS plus certificate check; CA text in `PGSSLROOTCERT_PEM`). Render's internal address doesn't need it; the external address used for the data copy does. |
| `STORAGE_DIR=/data/storage` | Private uploads on the Render disk. |
| `ASSETS_DIR=/data/assets` | Posters and video on the disk. On start, assets that ship in the app but are missing on the disk are copied there. **Existing files are never overwritten.** |
| `WORKER_TOKEN` | Must be at least 32 characters when public. |
| `GET /api/health` | Public health check (`ok`, `db`, `stream`, `mode`, date). No secrets or settings in it. |
| Security headers | nosniff, frame DENY, same-origin referrer/opener/resource policy, permissions policy, a CSP on the app page, HSTS behind HTTPS. |
| `corepack pnpm start` | Production start (no `.env` file; the host provides the variables). |
| `Dockerfile`, `.dockerignore`, `render.yaml` | Image build: the web app is built inside it; the server runs as a non-root user with a health check. `.dockerignore` keeps `.env`, `.local-*`, `storage/`, worktrees and `.git` out. The `render.yaml` Blueprint holds no secrets. |

Secrets check: `/api/health` and `/api/connections` show no secrets (stored connection secrets are never
returned). Error responses don't include stack traces. Logs record the method, URL and IP, not cookies or tokens.
`SESSION_SECRET` and `SECRETS_MASTER_KEY` aren't used by any code yet, but keep setting them.

## 3. Steps

### A. AIN (accounts and approval) — about 20 minutes
1. ~~Approve the plan and monthly cost~~ **Done:** AIN approved USD 14.55/month on 11 Nov 2026. Moving to the larger database (USD 27.55) would need her approval again.
2. **Create a GitHub account** (if needed) and an **empty private repository**, e.g. `candy-control-room`.
   Don't add a README. Turn on two-factor sign-in.
3. **Create a Render account** (render.com; "Sign in with GitHub" is fine), add a payment card and turn on two-factor sign-in.
4. In Render, allow access to **only** the `candy-control-room` repository.

### B. Ryan, with AIN watching (after A; needs AIN's go-ahead to push and deploy)
1. Push the released `master` branch to the private repo:
   `git remote add origin https://github.com/<AIN>/candy-control-room.git` then `git push -u origin master`.
   Check first that `git status` shows no `.env` or `.local-*` files; they are git-ignored.
2. In Render, choose **New → Blueprint**, pick the repo, and review `render.yaml`. It creates `candy-db` (Postgres 16,
   Singapore) and `candy-control-room` (Docker, Starter, 5 GB disk at `/data`). Don't deploy the web service yet if
   Render offers the choice; otherwise **suspend it right after it is created** so it doesn't create an empty database first.
3. **Secrets, set in the Render dashboard only** (Environment tab, never in git):
   - `WORKER_TOKEN`: a **new** random value (`node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`).
     A new token means the old one on the PC stops mattering once the PC server is retired.
   - `SECRETS_MASTER_KEY`: the same value as in the PC's `.env`.
   - `SESSION_SECRET` is generated by Render. `DATABASE_URL` is filled in from `candy-db` automatically.

### C. Copy AIN's data (Ryan, on AIN's PC)
1. **Stop the PC server** (3100), so nothing changes during the copy.
2. Dump the database (Postgres 16 tools are installed):
   ```bash
   "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" --format=custom --no-owner --no-acl -h localhost -p 5433 -U postgres -d candy -f candy-2026-11-XX.dump
   ```
   Keep this file somewhere private. It contains business data and password hashes.
3. In Render → `candy-db` → Networking, **temporarily** allow only the PC's current IP. Copy the **External** connection URL.
4. Restore into the hosted database (TLS is required on the external address):
   ```bash
   "C:\Program Files\PostgreSQL\16\bin\pg_restore.exe" --no-owner --no-acl --clean --if-exists -d "<EXTERNAL_URL>?sslmode=require" candy-2026-11-XX.dump
   ```
   Then remove the IP from the allow list again.
5. **Files.** `assets/` is in git and lands on the disk automatically on first start (missing files only).
   `storage/` currently holds one private upload (2.1 MB). Copy it with Render SSH (add an SSH key in Render first):
   `tar -czf - storage | ssh <service-ssh-address> "tar -xzf - -C /data"`. Then check that `/data/storage` has it.
   If SSH file copying doesn't work, re-upload that one file on the Team → Training screen and delete the old entry.
   **Not verified yet.**
6. Resume the web service and wait for `/api/health` to show `"ok": true`. Open the URL and sign in as AIN (same password as on the PC).
   Check the Approval Inbox, Daily PRs and one poster image.

### D. Point the 6 Claude sessions at the hosted app
In the main folder's `.env` on the PC, set:
```
CANDY_URL=https://<your-service>.onrender.com
WORKER_TOKEN=<the new token from B3>
```
The `corepack pnpm worker …` commands then talk to the hosted app over HTTPS. Test with
`corepack pnpm worker inbox --json`. Keep the PC's own server stopped, so there is only one source of truth.

**Open item (not built yet):** posters and videos that the sessions render on the PC are written to the PC's
`assets/` folder. On the hosted app they appear only after they're committed and redeployed (copied as missing
files), or copied to `/data/assets` over SSH. A small "upload asset" worker command would fix this. Planned, not built.

## 4. Backups and restore
- **Database:** Render keeps point-in-time recovery: 3 days on Hobby, 7 days on Pro. To restore, open Render → `candy-db` →
  Recovery, choose a time, and Render creates a new database. Point `DATABASE_URL` at it, or follow Render's
  promote steps.
- **Extra weekly copy (recommended):** on the PC once a week, run `pg_dump` against the external URL (same command as C2,
  with the allow list), and keep 4 weeks of copies in a private folder.
- **Files:** Render takes a daily disk snapshot, kept 7 days. Restore from the service's Disks tab.

## 5. Roll back
- **Bad deploy:** Render → service → Deploys → pick the previous deploy → **Rollback**. This doesn't touch the database or disk.
- **Bad data:** use the database point-in-time restore (section 4).
- **Leave hosting entirely:** set `CANDY_URL` back to `http://127.0.0.1:3100` on the PC, dump the hosted database
  (C2 against the external URL), restore it into the PC's `candy` database with `pg_restore --clean --if-exists`,
  and start the PC server again. Then suspend or delete the Render services. Deleting is permanent, so do it only with AIN's go-ahead.

## 6. Not verified
- The Docker image hasn't been built. There is no Docker on this PC, and we didn't install it.
- `render.yaml` hasn't been checked by Render, because there's no account. Field names follow Render's Blueprint docs.
- The SSH copy of `storage/` (C5) and the Starter plan's memory headroom are untested.
- Prices come from the official pages on 11 Nov 2026 and can change. Render's $0 Hobby workspace fee is from a Render article.
