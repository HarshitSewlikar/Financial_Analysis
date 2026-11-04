# Financial Analytics Dashboard — Django Backend

Django 5 + Django REST Framework backend for the Financial Analytics Dashboard. It provides JWT authentication, role-based access control (RBAC), navigation menus, to-dos, audit logging, and market data integration. The default database is Microsoft SQL Server via `config/settings_sqlserver.py`. MySQL 8 remains available through `config/settings.py`.

## Requirements

- Python 3.11+
- SQL Server with Microsoft ODBC Driver 18 — default backend via `settings_sqlserver.py`
- MySQL 8 (InnoDB, `utf8mb4`) — legacy reference via `config.settings`
- Node.js 18+ (only for the optional stock-score parity test)

## Setup

```powershell
cd backend-django
python -m venv .venv
.venv/Scripts/Activate.ps1        # Windows
# source .venv/bin/activate        # macOS/Linux
pip install -r requirements-sqlserver.txt
```

Copy the environment template and fill in real values:

```powershell
cp .env.example .env
# Edit .env: set DJANGO_SECRET_KEY, DB_PASSWORD, ADMIN_SIGNUP_CODE, and other values
```

### Required environment variables

- `DJANGO_SECRET_KEY` — mandatory. Generate with:
  ```powershell
  python -c "import secrets; print(secrets.token_urlsafe(64))"
  ```
- `DB_PASSWORD` — mandatory for the MySQL configuration. No insecure fallback is used.
- `ADMIN_SIGNUP_CODE` — one-time code to create the first administrator.

`settings.py` raises a `RuntimeError` if `DJANGO_SECRET_KEY` or `DB_PASSWORD` (MySQL) is missing. `.env` is git-ignored and must never be committed.

## Configure the database

### MySQL (legacy reference)

Create the database and a least-privilege user:

```sql
CREATE DATABASE financial_dashboard CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'finapp'@'localhost' IDENTIFIED BY '<your-password>';
GRANT ALL PRIVILEGES ON financial_dashboard.* TO 'finapp'@'localhost';
CREATE DATABASE test_financial_dashboard CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON test_financial_dashboard.* TO 'finapp'@'localhost';
FLUSH PRIVILEGES;
```

Set `DB_PASSWORD` in `.env` to match the MySQL user password.

### Microsoft SQL Server (default)

`config/settings_sqlserver.py` is what `manage.py` loads. It uses the `mssql` backend with Windows Integrated Authentication (`Trusted_Connection=yes`), `mssql-django`, and `pyodbc`. No `DB_PASSWORD` is required.

To use the legacy MySQL module instead:

```powershell
$env:DJANGO_SETTINGS_MODULE = "config.settings"
pip install -r requirements.txt
```

## Run migrations and start the server

```powershell
python manage.py migrate
python manage.py seed_rbac      # seeds permissions, roles, and the code-defined pages
python manage.py runserver 127.0.0.1:8000
```

Health check: `GET http://127.0.0.1:8000/api/health/`.

## First administrator

The very first administrator is created through a one-time bootstrap endpoint protected by `ADMIN_SIGNUP_CODE`:

```bash
POST /api/v1/auth/bootstrap/
{ "username": "...", "email": "...", "password": "...", "signup_code": "<ADMIN_SIGNUP_CODE>" }
```

Once an administrator exists, the endpoint returns `410 Gone`. The bootstrapped account is a **protected administrator**: it implicitly holds every registered permission, cannot be deactivated, and cannot have its roles or overrides changed.

## Authentication model

- **Access token:** short-lived JWT (default 8 minutes), returned in the response body and held by the SPA in memory only.
- **Refresh token:** long-lived JWT (default 7 days) in an HttpOnly, SameSite=Lax cookie (`fd_refresh`) scoped to `/api/v1/auth/`. Rotation and blacklist are enabled.
- `POST /api/v1/auth/login/`, `POST /api/v1/auth/token/refresh/`, and `POST /api/v1/auth/logout/` are CSRF-protected. The SPA fetches `GET /api/v1/auth/csrf/` on startup and sends the `X-CSRFToken` header on non-GET requests.

## API endpoints

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/health/` | liveness + DB check |
| GET | `/api/v1/auth/setup-status/` | whether an admin exists |
| POST | `/api/v1/auth/bootstrap/` | one-time first admin |
| POST | `/api/v1/auth/login/` | returns access token + user |
| POST | `/api/v1/auth/token/refresh/` | rotates refresh cookie |
| POST | `/api/v1/auth/logout/` | blacklists refresh, clears cookie |
| GET | `/api/v1/auth/me/` | current user |
| GET | `/api/v1/auth/me/access/` | effective permissions + menu tree |
| GET | `/api/v1/auth/csrf/` | CSRF cookie |
| CRUD | `/api/v1/users/` | user administration + roles/overrides sub-routes |
| CRUD | `/api/v1/roles/` | roles + `/:id/permissions/`, `/:id/menus/` |
| CRUD | `/api/v1/permissions/` | permission catalog |
| GET | `/api/v1/menus/` | page catalog for role assignment |
| CRUD | `/api/v1/todos/` | scoped to-dos + `/assign/`, `/status/` |
| GET | `/api/v1/audit-logs/` | cursor-paginated audit trail |
| GET | `/api/v1/audit-logs/export/` | CSV export |
| GET | `/api/v1/market/stock-daily/<symbol>/` | daily OHLCV |
| GET | `/api/v1/market/sector-performance/` | sector performance |
| GET | `/api/v1/market/movers/` | gainers / losers / most active |
| GET | `/api/v1/market/stock-score/<symbol>/` | composite score |

Market responses set `X-Data-Source: live|mock`.

## RBAC

Permissions are **code-registered** in `access_control/catalog.py`. A `Permission` row is only enforced when its code appears in that catalog — adding rows cannot create new capabilities. The single source of truth for authorization is `access_control/policy.py` (deny-overrides-grant, request-scoped). `is_staff` / `is_superuser` only gate the Django admin, never application RBAC.

Seed roles: `administrator`, `auditor`, `standard_user`.

## To-dos

Statuses: `open → in_progress → {blocked, completed, cancelled}`. Transitions outside the allowed graph are rejected. Users without `todos.manage` only see to-dos they own or are assigned.

## Market data

`market_data/mock_data.py` provides deterministic mock data when `USE_MOCK_DATA=true` or `ALPHA_VANTAGE_API_KEY` is empty. Live data is fetched from Alpha Vantage and cached by Django.

## Tests

```powershell
pytest -c pytest.ini tests
```

The suite covers auth, RBAC/delegation, to-do scoping and transitions, audit writes, market endpoints, and legacy-user import.

## Security notes

- `Argon2` is the first password hasher; `bcrypt` is kept for imported hashes.
- Login, bootstrap, and refresh endpoints are throttled.
- Direct edits in MySQL Workbench bypass Django signals and are not audited — always perform privileged changes through the API or management commands.
- `DJANGO_SECRET_KEY` and `DB_PASSWORD` (MySQL) are required environment variables with no fallback.
