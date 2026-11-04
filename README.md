# Financial_Analysis

Full-stack financial and stock market analysis application. The backend is built with Django 5 and Django REST Framework; the frontend is a React 19 + Vite application. The application provides stock market dashboards, authentication, role-based access control (RBAC), to-dos, and audit logging.

Repository: `https://github.com/HarshitSewlikar/Financial_Analysis`

## Features

- **Stock market dashboard:** line charts, pie charts, bar charts, heatmaps, and tabular market views
- **Sector performance:** real-time distribution across market sectors
- **Top gainers / losers:** most actively traded stocks and latest daily OHLCV
- **Stock score:** composite score from volatility, growth rate, and volume
- **Authentication:** JWT access token held in memory, HttpOnly refresh token cookie, CSRF protection
- **Role-based access control (RBAC):** code-registered permissions, roles, per-user overrides, dynamic navigation menus
- **User management:** create users, assign roles, and manage permission overrides
- **To-dos:** scoped task management with enforced status transitions
- **Market data:** Alpha Vantage integration with deterministic offline mock data and API response caching
- **Audit logging:** cursor-paginated audit trail with CSV export

## Technology Stack

**Backend (Django)**

- Python 3.11+
- Django 5.2.18
- Django REST Framework 3.17.2
- Django REST Framework SimpleJWT 5.5.1
- django-cors-headers, django-filter
- argon2-cffi, bcrypt (password hashing)
- Microsoft SQL Server (default, via `config/settings_sqlserver.py`, `mssql-django`, `pyodbc`, Windows Integrated Authentication). MySQL settings remain in `config/settings.py` as a legacy reference.
- python-dotenv for environment configuration

**Frontend**

- React 19.1.0
- Vite 6.3.5
- Tailwind CSS v4.3.3
- TanStack Query v5.104.2
- React Router 7.1.1
- Recharts 2.15.3
- Axios 1.9.0
- Vitest 5.0.4

## Project Structure

```
Financial_Analysis/
├── backend-django/                 # Django + DRF backend
│   ├── apps/
│   │   ├── access_control/         # roles, permissions, policy, overrides
│   │   ├── accounts/               # users, bootstrap/login, JWT, user admin
│   │   ├── audit/                  # audit trail + CSV export
│   │   ├── common/                 # pagination, exceptions, utilities
│   │   ├── market_data/            # Alpha Vantage port, caching, scoring
│   │   ├── navigation/             # menus + visible menu tree
│   │   └── todos/                  # to-dos and transitions
│   ├── config/                     # settings, urls, health
│   ├── tests/                      # pytest suite
│   ├── tests_sqlserver/            # SQL Server settings tests
│   ├── requirements.txt            # legacy MySQL dependencies
│   ├── requirements-sqlserver.txt  # default SQL Server dependencies
│   ├── manage.py
│   └── README.md
├── financial-dashboard-frontend/   # React (Vite) frontend
│   ├── src/
│   │   ├── app/                    # router, query client, component registry
│   │   ├── components/             # layout + reusable UI/chart components
│   │   ├── features/               # auth, market, todos, users, roles, menus, permissions, audit
│   │   ├── services/               # http client + API endpoints
│   │   ├── hooks/                  # custom React hooks
│   │   ├── pages/                  # page components
│   │   ├── utils/                  # chart data utilities
│   │   ├── styles/                 # CSS stylesheets
│   │   └── context/                # React contexts
│   ├── package.json
│   ├── package-lock.json           (tracked)
│   └── vite.config.js
├── docs/                           # architecture and migration documentation
│   ├── ARCHITECTURE_REVIEW.md
│   ├── MIGRATION.md
│   └── MYSQL_TO_SQLSERVER_MIGRATION_PLAN.md
├── PLAN.md                         # project plan
├── .gitignore                      # excludes secrets, caches, venvs, build output
├── README.md                       # this file
```

**Intentionally excluded from Git:** `deployment-staging/` (deployment artifacts), root `package-lock.json` (empty placeholder), `Financial Dashboard.mp4` (92 MB media asset). These are ignored by `.gitignore` and are not part of the cloned repository.

## Installation and Setup

All commands below are Windows PowerShell.

### Prerequisites

- Python 3.11+
- Node.js 18+ and npm
- SQL Server with the Microsoft ODBC Driver 18 (default). MySQL 8 is only needed for the legacy reference settings.

### 1. Clone the repository

```powershell
git clone https://github.com/HarshitSewlikar/Financial_Analysis.git
cd Financial_Analysis
```

### 2. Backend (Django)

```powershell
cd backend-django

# Create and activate a virtual environment
python -m venv .venv
.venv/Scripts/Activate.ps1

# Install Python dependencies (SQL Server backend)
pip install -r requirements-sqlserver.txt

# Copy the environment template and fill in real values
cp .env.example .env
# Edit .env: set DJANGO_SECRET_KEY and ADMIN_SIGNUP_CODE
```

`manage.py`, WSGI, and ASGI load `config.settings_sqlserver` unless `DJANGO_SETTINGS_MODULE` is set. SQL Server uses Windows Integrated Authentication, so `DB_PASSWORD` is not required for the default startup.

### 3. Configure the database

**Microsoft SQL Server (default):**

Install the ODBC Driver 18 for SQL Server. The default settings module connects with `Trusted_Connection=yes`.

**MySQL (legacy reference only):**

Create the database and a least-privilege user:

```sql
CREATE DATABASE financial_dashboard CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'finapp'@'localhost' IDENTIFIED BY '<your-password>';
GRANT ALL PRIVILEGES ON financial_dashboard.* TO 'finapp'@'localhost';
CREATE DATABASE test_financial_dashboard CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON test_financial_dashboard.* TO 'finapp'@'localhost';
FLUSH PRIVILEGES;
```

Set `DB_PASSWORD` in `backend-django/.env` only when starting with the legacy module:

```powershell
$env:DJANGO_SETTINGS_MODULE = "config.settings"
pip install -r requirements.txt
```

### 4. Run Django migrations and start the server

```powershell
python manage.py migrate
python manage.py runserver 127.0.0.1:8000
```

The Django backend runs at `http://127.0.0.1:8000`.

### 5. Frontend (React + Vite)

```powershell
cd ../financial-dashboard-frontend
npm install
npm run dev
```

The Vite dev server runs at `http://localhost:5173` and proxies `/api` requests to the Django backend at `http://127.0.0.1:8000`.

### 6. First run

Open `http://localhost:5173`. With no administrator yet, the app shows a one-time setup screen to create the protected administrator using the `ADMIN_SIGNUP_CODE` from `backend-django/.env`. After setup, the login screen appears.

## Database Support

### Microsoft SQL Server (default)

`manage.py` loads `config.settings_sqlserver`. That module uses the `mssql` backend and Windows Integrated Authentication (`Trusted_Connection=yes`). Install dependencies with `requirements-sqlserver.txt`.

### MySQL (legacy reference)

`config/settings.py` still configures MySQL. It is not used unless `DJANGO_SETTINGS_MODULE` is set to `config.settings`. That path requires `DB_PASSWORD` and `requirements.txt`.

## Environment Configuration

`backend-django/.env.example` is the tracked environment template. Copy it to `backend-django/.env` for local development:

```powershell
cp .env.example .env
```

- `.env` is ignored by Git and must **never** be committed.
- `DJANGO_SECRET_KEY` is mandatory — generate one with:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

- `DB_PASSWORD` is mandatory for the MySQL configuration.
- SQL Server Windows Integrated Authentication does not require `DB_PASSWORD`.

No insecure fallback values are used.

## API Overview

Base path: `/api/v1/`

| Area | Endpoints |
|------|-----------|
| Health | `GET /api/health/` |
| Auth | `POST /api/v1/auth/bootstrap/`, `POST /api/v1/auth/login/`, `POST /api/v1/auth/token/refresh/`, `POST /api/v1/auth/logout/`, `GET /api/v1/auth/me/`, `GET /api/v1/auth/me/access/`, `GET /api/v1/auth/csrf/`, `GET /api/v1/auth/setup-status/` |
| Users | CRUD on `/api/v1/users/` plus roles and permission overrides |
| Roles | CRUD on `/api/v1/roles/` plus permissions and menus |
| Permissions | CRUD on `/api/v1/permissions/` |
| Menus | `GET /api/v1/menus/` |
| To-dos | CRUD on `/api/v1/todos/` plus `/assign/` and `/status/` |
| Audit | `GET /api/v1/audit-logs/`, `GET /api/v1/audit-logs/export/` |
| Market | `GET /api/v1/market/stock-daily/<symbol>/`, `GET /api/v1/market/sector-performance/`, `GET /api/v1/market/movers/`, `GET /api/v1/market/stock-score/<symbol>/` |

## Development Workflow

```powershell
# Backend tests
cd backend-django
pytest -c pytest.ini tests

# Frontend tests
cd ../financial-dashboard-frontend
npm test

# Frontend build
npm run build
```

## Security Notes

- `DJANGO_SECRET_KEY` and `DB_PASSWORD` (MySQL) are required environment variables with no fallback.
- `.env` is git-ignored and must never be committed.
- Access tokens are held in memory only; refresh tokens use HttpOnly cookies.
- Login, bootstrap, and refresh endpoints are rate-limited.
- `Argon2` is the primary password hasher.

## License

Open-source under the MIT License.
