# Financial_Analysis — Frontend

React-based user interface for the Financial_Analysis application. Communicates with the Django REST Framework backend at `http://127.0.0.1:8000`.

## Technology Stack

All dependencies verified against `package.json`:

- React 19.1.0
- Vite 6.3.5
- Tailwind CSS v4.3.3 (`@tailwindcss/vite` Vite plugin)
- TanStack Query v5.104.2
- React Router 7.1.1
- Recharts 2.15.3
- Axios 1.9.0
- React Select 5.10.1
- React Hook Form, Zod
- Vitest 5.0.4

## Installation and Execution

```powershell
cd financial-dashboard-frontend
npm install
npm run dev      # Vite dev server at http://localhost:5173
npm run build    # production build
npm test         # Vitest unit tests
```

## API Configuration

- Vite dev server port: `5173` (`vite.config.js`)
- Vite proxies `/api` requests to the Django backend at `http://127.0.0.1:8000` so refresh cookies stay same-origin in development.
- `VITE_API_BASE_URL` is referenced in `src/services/http.js` but no `.env.local` is tracked. When unset, requests default to `/api/v1` (relative to the Vite dev server, which proxies to Django).
- Vite itself is **not** the backend — it is the dev server/build tool. Django serves the API.

Expected local architecture:

| Service | Address |
|---------|---------|
| Frontend (Vite) | `http://localhost:5173` |
| Backend (Django) | `http://127.0.0.1:8000` |

## Authentication Flow

The modern authentication implementation (`src/features/auth/AuthProvider.jsx` + `src/services/http.js`) is used by the application router:

1. **Login:** `POST /auth/login/` returns a short-lived access token, held in memory only (never in `localStorage`).
2. **Refresh token:** long-lived JWT in an HttpOnly, SameSite=Lax cookie (`fd_refresh`), scoped to `/api/v1/auth/`. Rotation and blacklist are enabled.
3. **CSRF protection:** non-GET requests attach `X-CSRFToken` read from the `csrftoken` cookie. The SPA fetches `GET /auth/csrf/` on startup.
4. **Auto-refresh:** on a 401 response, the HTTP interceptor automatically calls `POST /auth/token/refresh/` and retries the original request.
5. **Logout:** `POST /auth/logout/` blacklists the refresh token and clears the session.
6. **Protected routes:** `RequireAuth` redirects unauthenticated users to `/login`; `RequireAdmin` redirects non-admins to `/dashboard`.

> Note: `src/context/AuthContext.jsx` and `src/services/api.js` contain an older, unused authentication implementation (localStorage token, fallback URL `http://localhost:5000/api`). They are not wired into the router and are kept only as historical reference.

## Frontend Project Structure

```
financial-dashboard-frontend/
├── src/
│   ├── app/                    # router, query client, component registry
│   │   ├── App.jsx
│   │   ├── componentRegistry.jsx
│   │   ├── queryClient.js
│   │   └── router.jsx
│   ├── components/
│   │   ├── admin/AdminChrome.jsx
│   │   ├── common/Ui.jsx
│   │   ├── layout/AppLayout.jsx
│   │   ├── BarChartCard.jsx
│   │   ├── DataSourceBanner.jsx
│   │   ├── HeatmapCard.jsx
│   │   ├── LineChartCard.jsx
│   │   ├── PieChartCard.jsx
│   │   ├── ProtectedRoute.jsx
│   │   └── TableComponent.jsx
│   ├── context/
│   │   └── AuthContext.jsx     # legacy, unused by router
│   ├── features/
│   │   ├── audit/AuditPage.jsx
│   │   ├── auth/AuthProvider.jsx, BootstrapPage.jsx, LoginPage.jsx, useAccess.js
│   │   ├── market/MarketDashboardPage.jsx
│   │   ├── menus/MenusAdminPage.jsx
│   │   ├── permissions/PermissionsAdminPage.jsx
│   │   ├── roles/RolesAdminPage.jsx
│   │   ├── todos/TodosPage.jsx
│   │   └── users/UsersAdminPage.jsx
│   ├── hooks/
│   │   └── useFetchData.js
│   ├── pages/
│   │   ├── AdminUsersPage.jsx
│   │   ├── DashboardPage.jsx
│   │   └── LoginPage.jsx
│   ├── services/
│   │   ├── api.js              # legacy, unused by router
│   │   ├── endpoints.js
│   │   └── http.js
│   ├── styles/
│   │   ├── Auth.css
│   │   └── Dashboard.css
│   ├── test/
│   │   └── setup.js
│   ├── utils/
│   │   ├── chartData.js
│   │   └── chartData.test.js
│   ├── assets/react.svg
│   ├── index.css
│   └── main.jsx
├── index.html
├── package.json
├── package-lock.json           (tracked)
├── vite.config.js
└── eslint.config.js
```

## License

Open-source under the MIT License.
