# Financial Analytics Dashboard — Django Backend

Django 5 + Django REST Framework backend for the Financial Analytics
Dashboard. It replaces the legacy Express service while preserving the market
data endpoints and adding JWT authentication, role-based access control,
navigation menus, to-dos, and audit logging on MySQL 8.

## Requirements

- Python 3.11+
- MySQL 8 (InnoDB, `utf8mb4`)
- Node.js 18+ (only for the optional stock-score parity test)

## Setup

```bash
cd backend-django
python -m venv .venv
.venv/Scripts/activate        # Windows
# source .venv/bin/activate    # macOS/Linux
pip install -r requirements.txt

cp .env.example .env          # then edit values
```

Create the database and a least-privilege user (root/bootstrap only):

```sql
CREATE DATABASE financial_dashboard CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'finapp'@'localhost' IDENTIFIED BY 'finapp_dev_pw';
GRANT ALL PRIVILEGES ON financial_dashboard.* TO 'finapp'@'localhost';
CREATE DATABASE test_financial_dashboard CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON test_financial_dashboard.* TO 'finapp'@'localhost';
FLUSH PRIVILEGES;
```

Apply migrations and seed the RBAC catalog:

```bash
python manage.py migrate
python manage.py seed_rbac      # 22 permissions, 3 roles, 7 menus
python manage.py runserver 127.0.0.1:8000
```

Health check: `GET http://127.0.0.1:8000/api/health/`.

## First administrator

The very first administrator is created through a one-time bootstrap endpoint
protected by `ADMIN_SIGNUP_CODE`:

```bash
POST /api/v1/auth/bootstrap/
{ "username": "...", "email": "...", "password": "...", "signup_code": "<ADMIN_SIGNUP_CODE>" }
```

Once an administrator exists the endpoint returns `410 Gone`. The bootstrapped
account is a **protected administrator**: it implicitly holds every registered
permission, cannot be deactivated, and cannot have its roles or overrides
changed.

## Importing legacy users

`backend/data/users.json` stores raw bcrypt hashes from the Node service. Django
needs a `bcrypt$` prefix to verify them, so the import converts the hash in
place:

```bash
python manage.py import_legacy_users            # dry run (default)
python manage.py import_legacy_users --apply     # write
```

## Authentication model

- Access token: short-lived JWT (default 8 min), returned in the response body
  and held by the SPA in memory only.
- Refresh token: long-lived JWT (default 7 days) in an HttpOnly, SameSite=Lax
  cookie (`fd_refresh`) scoped to `/api/v1/auth/`. Rotation + blacklist enabled.
- `POST /api/v1/auth/login/`, `POST /api/v1/auth/token/refresh/`, and
  `POST /api/v1/auth/logout/` are CSRF-protected; the SPA fetches
  `GET /api/v1/auth/csrf/` on startup and sends the `X-CSRFToken` header.

### Endpoints

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/health/` | liveness + DB check |
| GET | `/api/v1/auth/setup-status/` | whether an admin exists |
| POST | `/api/v1/auth/bootstrap/` | one-time first admin |
| POST | `/api/v1/auth/login/` | returns access token + user |
| POST | `/api/v1/auth/token/refresh/` | rotates refresh cookie |
| POST | `/api/v1/auth/logout/` | blacklists refresh, clears cookie |
| GET | `/api/v1/auth/me/` | current user |
| GET | `/api/v1/auth/me/access/` | effective permissions + menu tree |
| GET | `/api/v1/navigation/menus/` | visible menu tree |
| CRUD | `/api/v1/users/` | user administration + roles/overrides sub-routes |
| CRUD | `/api/v1/roles/` | roles + `/:id/permissions/`, `/:id/menus/` |
| CRUD | `/api/v1/permissions/` | permission catalog |
| CRUD | `/api/v1/menus/` | navigation definitions |
| CRUD | `/api/v1/todos/` | scoped to-dos + `/assign/`, `/status/` |
| GET | `/api/v1/audit-logs/` | cursor-paginated audit trail |
| GET | `/api/v1/audit-logs/export/` | CSV export |
| GET | `/api/v1/market/stock-daily/<symbol>/` | daily OHLCV (`market.read`) |
| GET | `/api/v1/market/sector-performance/` | sector performance |
| GET | `/api/v1/market/movers/` | gainers / losers / most active |
| GET | `/api/v1/market/stock-score/<symbol>/` | composite score |

Market responses set `X-Data-Source: live|mock`.

## RBAC

Permissions are **code-registered** in `access_control/catalog.py`. A
`Permission` row is only enforced when its code appears in that catalog — adding
rows cannot create new capabilities. The single source of truth for
authorization is `access_control/policy.py` (deny-overrides-grant, request
scoped). `is_staff` / `is_superuser` only gate the Django admin, never
application RBAC.

Seed roles: `administrator`, `auditor`, `standard_user`.

## To-dos

Statuses: `open → in_progress → {blocked, completed, cancelled}`. Transitions
outside the allowed graph are rejected. Users without `todos.manage` only see
to-dos they own or are assigned.

## Market data / parity

`market_data/mock_data.py` is a byte-for-byte port of the legacy
`backend/utils/mockData.js` (same FNV-1a hash, mulberry32 PRNG, price walk).
The one documented difference: the JS version labels dates with
`Date.toISOString()` (UTC) while the Python port labels in local time; the
numeric series is identical for a given seed. `market_data/scoring.py` mirrors
`backend/utils/stockScoreCalculator.js` and is checked by a parity test that
runs the original Node module.

Set `USE_MOCK_DATA=true` (or leave `ALPHA_VANTAGE_API_KEY` empty) for
deterministic sample data.

## Tests

```bash
pytest -c pytest.ini tests
```

The suite covers auth, RBAC/delegation, to-do scoping and transitions, audit
writes, market endpoints, legacy-user import, and the Node score parity.

## Security notes

- Argon2 is the first password hasher; bcrypt is kept for imported hashes.
- Login, bootstrap, and refresh endpoints are throttled.
- Direct edits in MySQL Workbench bypass Django signals and therefore are not
  audited — always perform privileged changes through the API or management
  commands.
