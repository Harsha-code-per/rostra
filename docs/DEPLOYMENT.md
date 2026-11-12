# Deploying Rostra on free tiers

| Part | Service | Notes |
|---|---|---|
| Database | **Neon** (free) | Permanent free Postgres. Scales to zero, so the first query after idle is slower. |
| API | **Render** (free web service, Docker) | Sleeps after ~15 min idle; the first request then takes ~50 s. |
| Web | **Vercel** (Hobby) | See the licence warning below. |

## 1. Database (Neon)

1. Create a project in the region closest to your Render region.
2. Copy the connection string (`postgresql://...?sslmode=require`). Paste it as is; the API handles the Neon-specific options.
3. Apply the schema once from your machine:
   ```bash
   cd backend
   DATABASE_URL='<neon url>' uv run alembic upgrade head
   ```
   The Docker image also runs `alembic upgrade head` on every start, so later deploys migrate themselves.

## 2. API (Render)

New **Web Service**, Docker, root directory `backend`. Environment variables:

| Variable | Value |
|---|---|
| `ENVIRONMENT` | `production` |
| `DATABASE_URL` | the Neon string |
| `JWT_SECRET_KEY` | 32+ random characters (`python -c "import secrets;print(secrets.token_urlsafe(48))"`). The API refuses to start without a strong one. |
| `CORS_ORIGINS` | exactly your web origin, e.g. `https://rostra-web.vercel.app` (no `*`) |
| `APP_BASE_URL` | the same web origin (used in emails) |
| `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD` | your platform-owner login. Created once on first start; change the password in the app afterwards, then remove these two variables. |
| `BREVO_API_KEY`, `EMAIL_FROM` | Email through [Brevo](https://www.brevo.com) (free, 300 a day) over HTTPS. Create the key under SMTP & API > API Keys; `EMAIL_FROM` is a sender you verified. **Use this on Render free: it blocks outbound SMTP ports 25, 465 and 587 (and 2525 times out), so SMTP cannot connect there.** |
| `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_HOST`, `SMTP_PORT` | Fallback for hosts that allow SMTP. Ignored when `BREVO_API_KEY` is set. |
| `API_DOCS_ENABLED` | `true` exposes interactive docs at `/docs` in production. Off by default because it publishes every endpoint. |
| `INQUIRY_NOTIFY_TO` | Address that is emailed when someone requests a workspace on the website. |

Health check path: `/health` (returns 503 if the database is unreachable). API docs are disabled in production.

**Keeping it awake:** point a free monitor (UptimeRobot, 5-minute interval) at `/health`. The web app also retries once when the API is waking up.

## 3. Web (Vercel)

Import the repo, root directory `frontend`. Environment variables:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://<your-service>.onrender.com/api/v1` |
| `NEXT_PUBLIC_SITE_URL` | your public web URL |

## Before the first paying customer

- **Vercel Hobby is for non-commercial use.** Charging customers breaks its terms. The web app is fully client-rendered, so it can move to Cloudflare Pages (free, commercial use allowed) or Vercel Pro with no code changes.
- Render free web services and Neon free projects have no SLA. Move up a tier when uptime becomes a contractual promise.
- Get a custom domain, authenticate it in Brevo (SPF and DKIM) so mail stops landing in spam, and run a trademark search for the name.
- Neon free keeps only a short point-in-time history. Export `pg_dump` regularly until you are on a paid plan.

## Operating notes

- Create customer workspaces from `/platform-admin` (sign in as the platform owner). Suspending a workspace locks everyone in it out immediately.
- Rate limits are per process (in memory). If you run more than one API instance, move them to Redis.
