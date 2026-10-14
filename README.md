# Financial Analytics Dashboard with Real-Time Data

A full-stack financial analytics dashboard. The original MERN implementation has
been migrated to a **Django + DRF + MySQL** backend with JWT authentication,
role-based access control, navigation menus, to-dos, and audit logging, and a
**React (Vite) + Tailwind CSS v4 + TanStack Query** frontend.

See [`docs/MIGRATION.md`](docs/MIGRATION.md) for the migration details and
[`backend-django/README.md`](backend-django/README.md) for backend specifics.

## Features

- **Stock Price Trend (line chart):** historical close price for a selected
  symbol over a selectable time range.
- **Sector Performance (pie chart):** real-time performance distribution across
  market sectors.
- **Top Gainers / Losers (bar charts)** and a **market performance heatmap**.
- **Stock Score:** composite score from volatility, growth rate, and volume.
- **Tabular views:** most actively traded stocks and the latest daily OHLCV.
- **Authentication:** JWT access token (in memory) + HttpOnly refresh cookie.
- **RBAC:** code-registered permissions, roles, per-user overrides, dynamic
  navigation menus, and an audit trail (with CSV export).
- **To-dos:** scoped task management with enforced status transitions.
- **API proxy & caching:** Django caches Alpha Vantage responses and falls back
  to deterministic mock data when no key is configured.

## Tech Stack

**Frontend:** React 19, Vite, Tailwind CSS v4, TanStack Query v5, React Router,
Recharts, react-select, date-fns, axios.

**Backend:** Django 5, Django REST Framework, SimpleJWT, django-cors-headers,
django-filter, MySQL 8, Argon2/bcrypt password hashing, pytest.

**Data source:** Alpha Vantage API (with a deterministic offline mock).

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Python 3.11+
- MySQL 8

### 1. Backend (Django)

```bash
cd backend-django
python -m venv .venv
.venv/Scripts/activate            # Windows
# source .venv/bin/activate        # macOS/Linux
pip install -r requirements.txt
cp .env.example .env               # set DB creds, SECRET_KEY, ADMIN_SIGNUP_CODE
python manage.py migrate
python manage.py seed_rbac
python manage.py runserver 127.0.0.1:8000
```

Full setup, database, and endpoint details: [`backend-django/README.md`](backend-django/README.md).

### 2. Frontend (React)

```bash
cd financial-dashboard-frontend
npm install
# .env.local already sets VITE_API_BASE_URL=/api/v1
npm run dev
```

The dev server runs at `http://localhost:5173` and proxies `/api` to the Django
server, so the refresh cookie stays same-origin.

### 3. First run

Open `http://localhost:5173`. With no administrator yet, the app shows the
one-time setup screen; enter the `ADMIN_SIGNUP_CODE` from the backend `.env` to
create the protected administrator. After that the login screen appears.

## Project Structure

```
MERN-Financial-Analytics-Dashboard/
├── backend-django/                 # Django + DRF backend (current)
│   ├── apps/
│   │   ├── accounts/               # users, bootstrap/login, JWT, user admin
│   │   ├── access_control/         # roles, permissions, policy, overrides
│   │   ├── navigation/             # menus + visible menu tree
│   │   ├── todos/                  # to-dos and transitions
│   │   ├── audit/                  # audit trail + CSV export
│   │   ├── market_data/            # Alpha Vantage port, caching, scoring
│   │   └── common/                 # pagination, exceptions, utilities
│   ├── config/                     # settings, urls, health
│   ├── tests/                      # pytest suite (+ Node parity harness)
│   ├── requirements.txt
│   └── README.md
├── financial-dashboard-frontend/   # React (Vite) frontend (current)
│   ├── src/
│   │   ├── app/                    # router, query client, component registry
│   │   ├── components/             # layout + reusable UI/chart components
│   │   ├── features/               # auth, market, todos, users, roles, ...
│   │   ├── services/               # http client + API endpoints
│   │   └── main.jsx
│   ├── vite.config.js              # Tailwind v4 + dev proxy to Django
│   └── package.json
├── backend/                        # LEGACY Express service (kept for rollback)
├── docs/MIGRATION.md
└── README.md
```

## Testing

```bash
# Backend (Django + parity)
cd backend-django
pytest -c pytest.ini tests

# Frontend unit tests (Vitest)
cd ../financial-dashboard-frontend
npm test

# Frontend build check
npm run build
```

## License

Open-source under the MIT License.
