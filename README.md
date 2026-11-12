# Rostra

Attendance, leave and payroll for HR teams, as a multi-tenant web app.

- **Web:** Next.js 16 (App Router), React 19, Tailwind 4, three.js landing page. `frontend/`
- **API:** FastAPI, async SQLAlchemy 2, Alembic, PostgreSQL. `backend/`
- **Roles:** platform owner (`SUPER_ADMIN`), company `ADMIN`, `HR`, `EMPLOYEE`. Every company is an isolated tenant.

Rostra is designed and built by Harshavardhan K and Cholan Kinnera. This is proprietary software; see [LICENSE](LICENSE).

## Run it locally

```bash
# API (Python 3.14, uv)
cd backend
cp .env.example .env
uv sync
uv run uvicorn app.main:app --reload        # http://localhost:8000  (docs at /docs)

# Web (Node 22, pnpm)
cd frontend
cp .env.example .env.local
pnpm install
pnpm dev                                    # http://localhost:3000
```

In development the API seeds a demo company on startup. Sign in with:

| Role | Email | Password |
|---|---|---|
| Company admin | `admin@demo.example.com` | `password123` |
| HR | `sarah.hr@demo.example.com` | `password123` |
| Employee | `alex.rivera@demo.example.com` | `password123` |
| Platform owner (`/platform-admin/login`) | `owner@demo.example.com` | `RostraPlatform#2026` |

These are development-only. With `ENVIRONMENT=production` nothing is seeded.

## Check your work

```bash
cd backend  && uv run ruff check . && uv run pytest -q
cd frontend && pnpm lint && pnpm typecheck && pnpm build
cd frontend && pnpm exec playwright install chromium && pnpm test:e2e   # starts both servers itself
```

CI (`.github/workflows/ci.yml`) runs all of the above, plus the migrations against a real Postgres.

## Deploying for free

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): Vercel (web) + Render (API) + Neon (Postgres), including the limits of each free tier.

## Layout

```
backend/app/api         HTTP routes            backend/app/services   business logic
backend/app/models      SQLAlchemy models      backend/alembic        migrations (head: 0006)
frontend/app            pages                  frontend/lib/api.ts    the only place that talks to the API
frontend/components     UI                     frontend/e2e           Playwright + axe accessibility tests
```
