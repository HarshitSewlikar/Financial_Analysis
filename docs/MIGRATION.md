# MERN → Django + MySQL Migration Guide

This document records what changed when the Financial Analytics Dashboard moved
from the legacy Node/Express + JSON-file backend to a Django + DRF + MySQL
backend, how to run both during the transition, and how to roll back.

## What changed

| Area | Legacy | Current |
| --- | --- | --- |
| Backend | Express (`backend/`) | Django + DRF (`backend-django/`) |
| Storage | `backend/data/users.json` | MySQL 8 (InnoDB) |
| Auth | custom, plain users file | JWT (simplejwt) + HttpOnly refresh cookie |
| Authorization | `role` field on user | code-registered RBAC (roles/permissions/overrides) |
| Market data | Alpha Vantage proxy | same endpoints, cache + deterministic mock |
| Styling | global CSS | Tailwind CSS v4 |
| Data fetching | `useFetchData` hook | TanStack Query v5 |
| Routing | static routes | routes derived from server-provided menu tree |

The legacy `backend/` service and `backend/data/users.json` are **preserved
unchanged** for rollback. Nothing deletes them.

## Frontend integration

- Vite dev server proxies `/api` to `http://127.0.0.1:8000` (`vite.config.js`),
  so the refresh cookie is same-origin in development. `VITE_API_BASE_URL`
  defaults to `/api/v1`.
- The access token is kept in memory only. On load the SPA calls
  `GET /api/v1/auth/csrf/` then `POST /api/v1/auth/token/refresh/` to silently
  restore a session.
- Routes are built from `GET /api/v1/auth/me/access/`. Each menu's
  `component_key` is resolved through a fixed allowlist
  (`src/app/componentRegistry.jsx`); unknown keys render a config error rather
  than executing arbitrary imports.
- Menus/`/access` are re-fetched every 30s and on window focus, so permission or
  role changes take effect without a full reload.

## Bug fixed during migration

`LineChartCard` previously sliced the last 90 points (`data.slice(-90)`) and set
`reversed={true}` on the X axis. Combined with the server already returning
ascending, range-filtered data, this produced a mismatched range and a
reverse-chronological axis. The chart now renders the data it is given, in
chronological order.

## Parity notes

- `mock_data.py` reproduces the JS generator's numbers exactly. Only the date
  labels can differ by one day because the JS version uses UTC
  `Date.toISOString()` and the Python port uses local time.
- `scoring.py` matches `backend/utils/stockScoreCalculator.js`; a parity test
  runs the original Node module as a subprocess and compares results.

## Running during the transition

```bash
# Django backend
cd backend-django && .venv/Scripts/python.exe manage.py runserver 127.0.0.1:8000

# Frontend (proxies /api to Django)
cd financial-dashboard-frontend && npm run dev
```

## Rollback

1. Stop the Django server and the new frontend build.
2. Restore the frontend to the legacy `src/` (git checkout of the pre-migration
   commit) and set `VITE_API_BASE_URL=http://localhost:5000/api`.
3. Start the legacy service: `cd backend && npm install && npm start`.
4. MySQL data is additive and untouched by rollback; the legacy JSON store is
   still present at `backend/data/users.json`.

## Known limitations

- Direct MySQL edits bypass Django signals and are not audited.
- `gunicorn` is Linux/macOS only; on Windows use `waitress` for production.
- Frontend unit tests (Vitest) cover pure helpers (`chartData`, `flattenMenus`,
  `extractError`); browser E2E tests are not yet included.
