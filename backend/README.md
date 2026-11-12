# Rostra API

FastAPI + async SQLAlchemy + Alembic. See the [root README](../README.md) for running everything together and [docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md) for hosting.

```bash
uv sync
cp .env.example .env
uv run alembic upgrade head          # or let dev mode create tables and seed demo data on startup
uv run uvicorn app.main:app --reload # interactive docs at /docs (development only)
uv run ruff check . && uv run pytest -q
```

## Shape

- `app/api/*` routes under `/api/v1`: auth, employees, attendance, leaves, payroll, analytics, notifications, public inquiries, super-admin.
- `app/core/permissions.py`: `get_current_user` (loads the user, rejects suspended workspaces and tokens issued before a password change) and `require_roles`.
- Tenancy: every query filters by the caller's `company_id`. `tests/test_tenant_isolation.py` and `tests/test_security_regressions.py` hold the guarantees.
- `app/db_url.py`: accepts Render/Neon style URLs. `app/bootstrap.py`: first platform owner from env.

## Security behaviour worth knowing

- Role creation is a whitelist: ADMIN may create HR/EMPLOYEE, HR may create EMPLOYEE, nobody can create SUPER_ADMIN through the API.
- Password reset uses hashed, single-use, expiring tokens. Sign-in, forgot-password, reset and the public inquiry form are rate limited.
- In production the API refuses to start with a weak `JWT_SECRET_KEY` or a wildcard CORS origin, never seeds demo data, and hides `/docs`.
- Plan limit: a company's `max_employees` is enforced when onboarding (HTTP 402).

## Migrations

`alembic upgrade head` (currently `0006`). Add a new revision with `uv run alembic revision -m "..."`; do not edit applied ones.
