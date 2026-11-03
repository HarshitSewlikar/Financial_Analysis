# Financial Analytics Dashboard — Architecture Review

Status: factual implementation handoff with a known-issues register.
Scope: the repository at `Financial_Analysis/` (Django + DRF + MySQL backend,
React + Vite frontend).
Method: static reading of the source tree. No commands were executed and the
real backend `.env` was not opened; environment variables are documented by
name only. Anything not directly evidenced in source is marked as unverified.

---

## 1. System at a glance

The project is a two-service web application:

- `backend-django/` — Django 5.2 + Django REST Framework API, MySQL 8 storage,
  JWT authentication, code-registered RBAC, dynamic navigation menus,
  to-dos, audit logging, and a market-data proxy with deterministic offline
  mock data.
- `financial-dashboard-frontend/` — React 19 single-page application built
  with Vite 6, Tailwind CSS v4, TanStack Query v5, React Router 7, Axios and
  Recharts. Routes and navigation are derived from menus returned by the API.

The frontend never holds a refresh token in JavaScript. The access token lives
in memory only; the refresh token travels in an HttpOnly cookie. Authorization
is enforced exclusively by the backend — the frontend uses permission data
only to hide/disable controls.

The legacy Express backend referenced by the documentation is **not present**
in the repository (see issue H1).

---

## 2. Repository layout

```
Financial_Analysis/
├── .git/
├── .qodo/                        # empty agents/ and workflows/ directories
├── backend-django/
│   ├── .env                      # real secrets; intentionally not read
│   ├── .env.example
│   ├── .venv/
│   ├── apps/
│   │   ├── access_control/       # catalog, policy, roles, permissions, auth
│   │   ├── accounts/             # custom User, bootstrap, login, user admin
│   │   ├── audit/                # audit model, service, middleware, API
│   │   ├── common/               # exceptions, pagination, context, utils
│   │   ├── market_data/          # Alpha Vantage client, cache, scoring, mocks
│   │   ├── navigation/           # menus, role-menu mapping, visible tree
│   │   └── todos/                # to-dos, state machine, scoping
│   ├── config/                   # settings, urls, health, wsgi, asgi
│   ├── logs/                     # rotating app.log at runtime
│   ├── sql/operator_access.sql   # MySQL views/procedures for operator access
│   ├── tests/                    # pytest suite + Node parity harness
│   ├── manage.py
│   ├── pytest.ini
│   ├── requirements.txt
│   └── README.md
├── docs/
│   ├── MIGRATION.md
│   └── ARCHITECTURE_REVIEW.md    # this document
├── financial-dashboard-frontend/
│   ├── public/
│   ├── src/
│   │   ├── app/                  # router, component registry, query client
│   │   ├── components/           # layout, shared UI, admin chrome, charts
│   │   ├── context/              # legacy AuthContext (unmounted)
│   │   ├── features/             # auth, market, todos, users, roles, ...
│   │   ├── hooks/                # legacy useFetchData (unmounted)
│   │   ├── pages/                # legacy pages (unmounted)
│   │   ├── services/             # current http/endpoints + legacy api.js
│   │   ├── styles/               # legacy dashboard/auth CSS (unimported)
│   │   ├── test/                 # Vitest setup
│   │   ├── utils/                # chartData + its test
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── eslint.config.js
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── Financial Dashboard.mp4
├── PLAN.md
├── README.md
└── package-lock.json
```

`backend-django/config/settings.py` inserts `backend-django/apps` into
`sys.path`, so local apps are importable by short labels (`accounts`,
`access_control`, …) instead of `apps.accounts`.

---

## 3. Technology stack

### Backend (from `requirements.txt`)

| Package | Version | Role |
| --- | --- | --- |
| Django | 5.2.18 | Web framework |
| djangorestframework | 3.17.2 | API layer |
| djangorestframework-simplejwt | 5.5.1 | JWT issuance, rotation, blacklist |
| django-cors-headers | 4.9.0 | Browser CORS |
| django-filter | 25.2 | Query filtering |
| argon2-cffi | 25.1.0 | Preferred password hasher |
| bcrypt | 5.0.0 | Legacy hash verification / fallback hasher |
| mysqlclient | 2.3.0 | MySQL driver |
| python-dotenv | 1.2.4 | `.env` loading |
| requests | 2.34.2 | Alpha Vantage HTTP client |
| pytest | 9.1.1 | Test runner |
| pytest-django | 4.14.0 | Django test integration |
| gunicorn | 23.0.0 (non-Windows marker) | Production WSGI server |

Runtime: Python 3.11+ (per README), MySQL 8 with InnoDB and `utf8mb4`.

### Frontend (from `package.json`)

Runtime dependencies: React 19.1, React DOM 19.1, React Router DOM 7.1,
TanStack Query 5.104, Axios 1.9, Recharts 2.15, Tailwind CSS 4.3 plus the Vite
plugin, react-select 5.10, date-fns 4.1, react-hook-form 7.90, zod 4.6,
@hookform/resolvers 5.9, react-tooltip 5.28.

Dev dependencies: Vite 6.3, Vitest 5.0, jsdom 29, Testing Library (react,
jest-dom, user-event), ESLint 9 with react-hooks and react-refresh plugins.

`react-hook-form`, `zod`, `@hookform/resolvers` and `react-tooltip` are
declared but not used by the current application code.

### Tooling files

- `backend-django/pytest.ini`: `DJANGO_SETTINGS_MODULE=config.settings`,
  `pythonpath = . apps`, `testpaths = tests`, `python_files = test_*.py`,
  `addopts = -q`, deprecation warnings ignored.
- `financial-dashboard-frontend/vite.config.js`: dev server on port 5173 with
  a `/api` proxy to `http://127.0.0.1:8000` (`changeOrigin: false`), Vitest
  with `jsdom`, globals enabled, setup file `./src/test/setup.js`, CSS
  processing disabled for tests.
- `financial-dashboard-frontend/eslint.config.js`: flat config for JS/JSX,
  browser globals, recommended JS rules, react-hooks and react-refresh rules,
  `no-unused-vars` with `varsIgnorePattern: '^[A-Z_]'`.
- No CI configuration (`.github/`, GitLab, Jenkins) exists.
- No OpenAPI/schema generation is configured.

---

## 4. Backend architecture

### 4.1 Settings and environment

`config/settings.py` loads `backend-django/.env` via python-dotenv. Key
behavior:

- `DJANGO_ENV` defaults to `development`; `DEBUG` defaults to
  `DJANGO_ENV != "production"`.
- `SECRET_KEY` is required in production. When `DEBUG` is true and no key is
  supplied, a deterministic development key is used
  (`dev-only-insecure-secret-key-change-me`). With `DEBUG=false` and no key,
  startup raises `RuntimeError`.
- `ALLOWED_HOSTS` defaults to `localhost`, `127.0.0.1`.
- CORS allows credentials and defaults to `http://localhost:5173` and
  `http://127.0.0.1:5173`; CSRF trusted origins mirror those.
- `ADMIN_SIGNUP_CODE` defaults to an empty string, which disables bootstrap
  (returns 503 `not_configured`).
- Database: MySQL, `utf8mb4`, `SET sql_mode='STRICT_TRANS_TABLES'`,
  `CONN_MAX_AGE` default 60, test database `test_financial_dashboard` with
  `utf8mb4_unicode_ci`.
- Password validators: similarity, minimum length 8, common-password, numeric.
- Hashers: Argon2 first, then PBKDF2, PBKDF2-SHA1, BCryptSHA256, BCrypt.
- DRF: authentication is `DatabaseJWTAuthentication`; default permission is
  `IsAuthenticated`; default pagination is page-number size 25; filter
  backends are DjangoFilter, Search, Ordering; custom exception handler; a
  global `ScopedRateThrottle` with rates for `login`, `bootstrap`, `refresh`.
- JWT: HS256, access lifetime `JWT_ACCESS_MINUTES` (default 8), refresh
  lifetime `JWT_REFRESH_DAYS` (default 7), rotation on, blacklist after
  rotation, `UPDATE_LAST_LOGIN` on.
- Refresh cookie: name `REFRESH_COOKIE_NAME` (default `fd_refresh`), path
  `REFRESH_COOKIE_PATH` (default `/api/v1/auth/`), HttpOnly always,
  `Secure` defaults to `not DEBUG`, `SameSite` default `Lax`.
- Caches: two locmem caches (`default`, `market_data`), 300 s default timeout,
  bounded entry counts. Throttling state and market data are therefore
  per-process; a multi-worker deployment does not share them.
- Market data: `ALPHA_VANTAGE_API_KEY` default empty, `USE_MOCK_DATA` default
  true, request timeout default 8 s, live TTL 300 s, mock TTL 60 s.
- Static files: `STATIC_URL = "static/"`, `STATIC_ROOT = staticfiles/`; no
  WhiteNoise or CDN configuration is present.
- Logging: console plus a rotating file handler at `logs/app.log`
  (5 MB × 3 backups), root level INFO, explicit loggers for
  `django.security` and `audit`.
- Production hardening when `DEBUG=false`: nosniff, secure session/CSRF
  cookies, SSL redirect (default on, overridable), HSTS 1 year with
  subdomains and preload, and `SECURE_PROXY_SSL_HEADER`.

### 4.2 Installed apps and URL map

Installed local apps: `accounts`, `access_control`, `navigation`, `todos`,
`audit`, `market_data`. Third-party: DRF, SimpleJWT (+ token blacklist),
corsheaders, django-filter.

`config/urls.py` exposes:

- `/admin/` — Django admin site.
- `/api/health/` — unauthenticated `HealthView`; runs `SELECT 1` and returns
  `{"status": "ok"|"degraded", "database": true|false}` with 200 or 503.
- `/api/v1/` — all API routes, composed from:
  - `auth/` → `accounts.urls`
  - `""` → `access_control.urls` (roles, permissions, user role/override
    sub-routes)
  - `""` → `accounts.api_urls` (users)
  - `""` → `navigation.urls` (menus, navigation tree)
  - `""` → `todos.urls`
  - `""` → `audit.urls`
  - `""` → `market_data.urls`

Each app uses DRF `DefaultRouter`. Because several routers are mounted at the
same `""` prefix, only the first router's API-root view is reachable at
`/api/v1/`; individual resource routes are unaffected.

### 4.3 Request lifecycle

1. `SecurityMiddleware`, CORS, sessions, common, CSRF, authentication,
   messages, clickjacking.
2. `audit.middleware.RequestContextMiddleware` stores per-request context in a
   `contextvars` object: correlation id (incoming `X-Request-ID` or a fresh
   UUID hex), client IP (first `X-Forwarded-For` entry or `REMOTE_ADDR`),
   and user agent (truncated to 512 characters). It also echoes
   `X-Request-ID` on the response.
3. DRF authenticates with `DatabaseJWTAuthentication`: it decodes the Bearer
   token, loads the user from the database on every request, and rejects
   inactive or soft-deleted accounts with error code `user_inactive`. The JWT
   carries identity only, never permissions.
4. The view's permission classes resolve effective permissions through
   `access_control/policy.py`. Permission results are memoized on the request's
   user instance only; there is no cross-request permission cache.
5. Mutating operations write an audit row via `audit.services.record_audit`
   inside the same transaction as the mutation where the code uses
   `transaction.atomic()`.
6. Errors are normalized by `common/exceptions.py`.

### 4.4 Response and error conventions

Error envelope:

```json
{
  "error": {
    "status": 403,
    "code": "permission_denied",
    "detail": "You do not have permission to perform this action."
  }
}
```

`common/exceptions.py` maps DRF `APIException` instances to this shape,
including field errors under `detail` when present. Exceptions that are not
DRF `APIException` subtypes fall through to Django's default handling
(typically a 500 HTML/JSON response in production). Validation errors from
Django's `ValidationError` (for example raised by `full_clean()` inside the
user manager) are not explicitly normalized.

Success responses follow DRF defaults: model serializers for resources,
`{"access": ..., "user": ...}` for login/bootstrap, `{"menus": [...]}` for
navigation, `{"permissions": [...], "is_protected_admin": bool, "menus": [...]}`
for access snapshots, and cursor/page-number envelopes as configured.

### 4.5 Pagination, filtering, search, ordering

- `StandardPageNumberPagination`: `page` query param, `page_size` default 25,
  maximum 200.
- `AuditCursorPagination`: cursor ordering `-created_at`, page size 50.
- ViewSets declare `search_fields`, `ordering_fields`, and (where relevant)
  `filterset_fields`. Search and ordering are exposed through DRF query
  parameters (`search`, `ordering`).
- `AuditLogViewSet` additionally reads `resource_type`, `object_id`, and
  `action` query parameters manually in `get_queryset`.

---

## 5. Data model

All primary keys are `BigAutoField` unless stated otherwise. Application
models use soft deletion (`deleted_at`) rather than physical deletion for
users, roles, and to-dos; menus and permissions are deactivated with
`is_active`.

### 5.1 `accounts`

**User** (`AUTH_USER_MODEL = "accounts.User"`)

Extends `AbstractBaseUser` and `PermissionsMixin`.

| Field | Type / notes |
| --- | --- |
| `id` | BigAutoField |
| `name` | CharField(150), blank |
| `username` | CharField(150), unique, min length 3, normalized lowercase |
| `email` | EmailField, nullable, unique, normalized lowercase |
| `is_active` | Boolean, default true |
| `is_staff` | Boolean, gates Django admin only |
| `is_superuser` | Boolean, gates Django admin only |
| `is_protected_admin` | Boolean, marks the bootstrap administrator |
| `created_at` | DateTime, default now, not editable |
| `updated_at` | DateTime, auto |
| `deleted_at` | DateTime, nullable |
| password / last_login | Inherited from `AbstractBaseUser` |

`UserManager` normalizes username/email, calls `full_clean()` on creation, and
provides `create_user` / `create_superuser`. `User.delete()` performs a soft
delete (sets `deleted_at` and `is_active=False`). Indexes: `is_active`,
`deleted_at`. Default ordering: `username`.

**SetupState** — singleton row with `id` forced to 1.

| Field | Type / notes |
| --- | --- |
| `id` | PositiveSmallInteger, primary key, forced to 1 |
| `is_bootstrapped` | Boolean |
| `bootstrap_admin` | FK User, null, `SET_NULL` |
| `completed_at` | DateTime, nullable |
| `updated_at` | DateTime, auto |

**LoginAttempt** — append-only login history used for lockout.

| Field | Type / notes |
| --- | --- |
| `username` | CharField(150), indexed |
| `ip_address` | GenericIPAddressField, nullable |
| `successful` | Boolean |
| `created_at` | DateTime auto, indexed |

Default ordering: newest first.

### 5.2 `access_control`

**Role**

| Field | Notes |
| --- | --- |
| `code` | CharField(100), unique |
| `name` | CharField(150) |
| `description` | Text |
| `is_system` | Boolean; system roles cannot be deleted via API |
| `is_active` | Boolean |
| `created_at`, `updated_at`, `deleted_at` | timestamps |

Index on `(is_active, deleted_at)`. Ordering by `name`.

**Permission**

| Field | Notes |
| --- | --- |
| `code` | CharField(150), unique |
| `resource` | CharField(100) |
| `action` | CharField(100) |
| `description` | Text |
| `is_system` | Boolean; identity fields immutable via API |
| `is_active` | Boolean |
| `created_at`, `updated_at` | timestamps |

A row is inert unless `code` is registered in the catalog (§7.1).

**RolePermission** — join table with `role`, `permission`, `granted_by`
(nullable), `created_at`; unique `(role, permission)`.

**UserRole** — join table with `user`, `role`, `assigned_by` (nullable),
`assigned_at`, `expires_at` (nullable); unique `(user, role)`; index on
`(user, expires_at)`. `is_current()` treats `expires_at=None` or a future
value as current.

**UserPermissionOverride** — `user`, `permission`, `effect`
(`ALLOW`/`DENY`), `granted_by` (nullable), `reason`, `created_at`,
`updated_at`; unique `(user, permission)`, so there is at most one override
per user/permission.

### 5.3 `navigation`

**Menu**

| Field | Notes |
| --- | --- |
| `code` | CharField(100), unique |
| `label` | CharField(150) |
| `path` | CharField(255) |
| `component_key` | CharField(100); must exist in the frontend allowlist |
| `required_permission` | CharField(150), blank; registered code or empty |
| `parent` | self-FK, null, `CASCADE` (code uses `parent_id=None` for roots) |
| `sort_order` | Integer |
| `is_active` | Boolean |
| `created_at`, `updated_at` | timestamps |

Index on `(is_active, sort_order)`. Ordering `(sort_order, label)`.

**RoleMenu** — `role`, `menu`, `granted_by` (nullable), `created_at`; unique
`(role, menu)`.

### 5.4 `todos`

**Todo**

| Field | Notes |
| --- | --- |
| `title` | CharField(255) |
| `description` | Text, blank |
| `status` | choice: `open`, `in_progress`, `blocked`, `completed`, `cancelled` |
| `priority` | choice: `low`, `normal`, `high`, `urgent` |
| `due_at` | DateTime, nullable |
| `owner` | FK User, required, `CASCADE`, related name `owned_todos` |
| `assignee` | FK User, nullable, `SET_NULL`, related name `assigned_todos` |
| `created_by` | FK User, nullable, `SET_NULL` |
| `updated_by` | FK User, nullable, `SET_NULL` |
| `created_at`, `updated_at`, `deleted_at` | timestamps |

Indexes: `(assignee, status, due_at)`, `(owner, status, due_at)`,
`(status, due_at)`, `deleted_at`. Ordering newest first.

### 5.5 `audit`

**AuditLog**

| Field | Notes |
| --- | --- |
| `actor` | FK User, nullable, `SET_NULL` |
| `action` | CharField(100) |
| `resource_type` | CharField(100) |
| `object_id` | CharField(100), blank |
| `before`, `after` | JSON, nullable |
| `correlation_id` | CharField(64), indexed, blank |
| `ip_address` | GenericIPAddressField, nullable |
| `user_agent` | CharField(512), blank |
| `created_at` | DateTime auto, indexed |

Indexes: `actor`, `(resource_type, object_id)`. Ordering newest first.

### 5.6 Migrations

| App | Migrations | Purpose |
| --- | --- | --- |
| accounts | `0001_initial` | `User`, `LoginAttempt` |
| accounts | `0002_setup_state_singleton` | Create the `SetupState` row (pk=1) |
| accounts | `0003_alter_user_options` | Default ordering by username |
| access_control | `0001_initial`, `0002_*` | Roles, permissions, joins, overrides |
| navigation | `0001_initial` | Menu, RoleMenu |
| navigation | `0002_menu_required_permission` | Add per-menu permission gate |
| todos | `0001_initial` | Todo table and indexes |
| audit | `0001_initial` | AuditLog and indexes |

Migration names beyond the ones above should be confirmed with
`python manage.py showmigrations` before deployment; this document lists the
migration modules observed in source.

---

## 6. Authentication and sessions

### 6.1 First-run bootstrap

- `GET /api/v1/auth/setup-status/` is public and returns
  `{"setup_complete": bool}` from `SetupState` pk=1.
- `POST /api/v1/auth/bootstrap/` is public, unauthenticated, and throttled at
  `THROTTLE_BOOTSTRAP` (default 5/min). Payload: username, password, optional
  name/email, and `signup_code`.
- `BootstrapSerializer` normalizes and validates: username matches
  `^[a-zA-Z0-9_.@+-]{3,150}$`, password minimum 8, email optional, and
  `signup_code` must equal `ADMIN_SIGNUP_CODE`.
- `bootstrap_admin()` runs in a single transaction, locks the `SetupState` row
  with `select_for_update()`, refuses if already bootstrapped, seeds RBAC
  (22 permissions, 3 roles, 7 menus), creates the user, marks it
  `is_protected_admin`, `is_staff`, and `is_superuser`, assigns the
  `administrator` role, and then flips the setup state.
- A second attempt returns **410 Gone** with code `setup_complete`. If
  `ADMIN_SIGNUP_CODE` is empty, `BootstrapSerializer.validate()` rejects the
  request with a 400 and a `signup_code` validation error. The service-level
  `SignupNotConfigured` → 503 `not_configured` path exists but is unreachable
  through the current view because the serializer fails first.
- The user manager calls `full_clean()`, so duplicate username or email raises
  `IntegrityError`/validation errors. The service converts **any**
  `IntegrityError` into `AlreadyBootstrapped`, which can misreport a duplicate
  email as "setup already complete" (issue M8).
- A successful bootstrap logs the user in immediately: it returns an access
  token and sets the refresh cookie.

### 6.2 Login and lockout

- `POST /api/v1/auth/login/` is public and throttled at `THROTTLE_LOGIN`
  (default 10/min).
- Username is trimmed and lowercased. Missing, inactive, soft-deleted, or
  wrong-password users all receive the same 401 response with code
  `invalid_credentials`; a failed `LoginAttempt` and an audit event
  (`login_failed`, actor null, `object_id` = username) are written.
- Lockout is evaluated **before** password checking: once five failures exist
  for the same username + IP within 15 minutes, subsequent attempts receive
  **429** with code `locked_out`.
- A successful login writes a `successful=True` `LoginAttempt`, updates
  `last_login`, audits `login_succeeded`, issues tokens, and sets the refresh
  cookie.
- Success does not delete or reset earlier failure rows, so a successful login
  inside the 15-minute window does not clear the failure count (issue M5).

### 6.3 Tokens and cookies

- Access token: HS256 JWT, returned in the JSON response body, held only in a
  module-level variable in the SPA (`src/services/http.js`). Default lifetime
  8 minutes.
- Refresh token: HS256 JWT in an HttpOnly cookie. Default lifetime 7 days.
  Cookie path defaults to `/api/v1/auth/`, `SameSite=Lax`, `Secure` when not
  in debug mode. `Secure`/`SameSite`/name/path are configurable.
- `POST /api/v1/auth/token/refresh/` is CSRF-protected, reads the cookie,
  validates and rotates it, blacklists the old token (rotation + blacklist are
  enabled), returns a new access token, and re-sets the cookie.
- `POST /api/v1/auth/logout/` is CSRF-protected, blacklists the presented
  refresh token if any, clears the cookie, and returns 204. It is not
  authenticated and not throttled.
- Logout is idempotent: a missing or invalid cookie still clears the cookie
  and returns 204.

### 6.4 CSRF

- `CsrfViewMiddleware` is enabled globally; Django session authentication is
  installed but not used by the API.
- `GET /api/v1/auth/csrf/` uses `ensure_csrf_cookie` to set the `csrftoken`
  cookie.
- Only `RefreshView` and `LogoutView` are decorated with `@csrf_protect`.
  `LoginView` and `BootstrapView` are not CSRF-protected. They are
  unauthenticated and do not rely on cookies for the operation itself, but the
  backend README claims login is CSRF-protected (issue M6).
- The SPA reads the `csrftoken` cookie and sends `X-CSRFToken` on non-GET
  requests (`src/services/http.js`). `ensureCsrfCookie()` is called on startup
  as a best-effort step.

### 6.5 Frontend auth flow

`src/features/auth/AuthProvider.jsx`:

1. Calls `GET /auth/setup-status/`.
2. Calls `GET /auth/csrf/` (best effort).
3. Calls `POST /auth/token/refresh/` to restore a session from the cookie.
4. On success, calls `GET /auth/me/` and sets the user.
5. Exposes `login`, `logout`, `bootstrap`, `user`, `isAuthenticated`,
   `setupComplete`, and a `didInit` guard so React StrictMode's double effect
   does not duplicate bootstrap work.
6. Clears the TanStack Query cache when authentication is lost.

The access token is attached by an Axios request interceptor; a single
in-flight refresh promise prevents concurrent refresh storms; a 401 triggers
one refresh-and-retry; an auth-lost callback clears client state.

### 6.6 Auth endpoint reference

| Method | Path (prefix `/api/v1`) | Access | CSRF | Throttle |
| --- | --- | --- | --- | --- |
| GET | `/auth/setup-status/` | public | no | — |
| POST | `/auth/bootstrap/` | public | no | 5/min |
| POST | `/auth/login/` | public | no | 10/min |
| POST | `/auth/token/refresh/` | public (cookie) | yes | 30/min |
| POST | `/auth/logout/` | public (cookie) | yes | — |
| GET | `/auth/csrf/` | public | no | — |
| GET | `/auth/me/` | authenticated | no | — |
| GET | `/auth/me/access/` | authenticated | no | — |

Defaults come from `THROTTLE_LOGIN`, `THROTTLE_BOOTSTRAP`, `THROTTLE_REFRESH`.

---

## 7. Authorization (RBAC)

### 7.1 Permission catalog

`access_control/catalog.py` is authoritative. Exactly 22 permission codes are
registered. A `Permission` database row is effective only if its code appears
in `REGISTERED_CODES`; inserting arbitrary rows cannot create capabilities.

| Resource | Codes |
| --- | --- |
| users | `users.read`, `users.create`, `users.update`, `users.deactivate` |
| roles | `roles.read`, `roles.manage`, `roles.assign` |
| permissions | `permissions.read`, `permissions.manage`, `permissions.assign` |
| menus | `menus.read`, `menus.manage`, `menus.assign` |
| todos | `todos.read`, `todos.create`, `todos.update`, `todos.delete`, `todos.assign`, `todos.manage` |
| audit | `audit.read`, `audit.export` |
| market | `market.read` |

### 7.2 Effective-permission algorithm

`access_control/policy.py` is the only place that computes effective
permissions. Order of precedence:

1. Anonymous, inactive, or soft-deleted user → empty set.
2. Active protected administrator → all registered codes, regardless of
   roles or overrides.
3. Otherwise, start with the union of permissions granted by the user's
   **current** roles:
   - role is active,
   - role is not soft-deleted,
   - user-role link is unexpired (`expires_at` null or future),
   - permission is active,
   - permission code is registered.
4. Apply user overrides: `DENY` removes the code; `ALLOW` adds it.
5. There is at most one override per user/permission; the uniqueness
   constraint enforces this. The resolver applies each row once, with DENY
   handled by removal and ALLOW by addition, so a DENY and ALLOW cannot both
   exist for the same code.
6. Unregistered codes are ignored everywhere.

The result is memoized on the user instance for the duration of the request
(`_effective_permission_codes`); it is never cached across requests.
`permissions_snapshot()` returns the sorted codes plus the protected-admin
flag.

### 7.3 Protected-administrator invariants

The bootstrap administrator is special:

- Holds every registered permission implicitly.
- Cannot be deactivated by another user; cannot be modified by another user.
- Cannot be deleted; the user endpoint refuses deactivation of protected
  accounts.
- Cannot have roles changed by another user.
- Cannot have permission overrides applied at all.
- Can modify itself (including name/email/password), but cannot deactivate
  itself through the update path.
- Only the protected administrator may modify the permissions of the
  `administrator` role.
- Role assignment refuses to remove the final active administrator. The
  override endpoint does not run the final-administrator check, so a holder of
  `permissions.assign` could apply DENY overrides to a non-protected
  administrator (see M9).

Edge case: `_active_administrator_count()` does not filter by
`expires_at`, so an expired `administrator` role assignment still counts as an
active administrator in the "last administrator" guard (issue M4).

### 7.4 Delegation invariants (privilege-escalation controls)

For non-protected actors:

- Assigning roles to a user requires `roles.assign`, and every role being
  assigned must be within the actor's own effective authority. A role's
  authority is the set of registered codes currently granted to it.
- Modifying role permissions requires `permissions.assign`, and the actor may
  only grant codes they effectively hold.
- Assigning menus to a role requires `menus.assign`, and the actor must hold
  every `required_permission` among the selected menus.
- Applying overrides requires `permissions.assign`, and the actor may only
  set overrides for codes they effectively hold.
- Creating permission definitions requires `permissions.manage` **and** the
  protected administrator flag. Non-protected administrators cannot create
  permission rows.
- System permission identity fields (`code`, `resource`, `action`) are
  immutable; the DELETE endpoints refuse to deactivate system permissions and
  system roles. However, `RoleSerializer` and `PermissionSerializer` expose
  `is_active` as writable, so PATCH can still deactivate a system role or
  permission (issue M10).
- Role changes use `select_for_update()` on the role, and user role/override
  changes lock the target user row, to serialize concurrent edits.

These checks reduce, but do not fully eliminate, the classic "role editor"
escalation risk: an actor who can edit a role they already belong to can add
only codes they already hold, but may be able to grant those codes to others
by first putting them on a shared role. Treat `permissions.assign` and
`roles.assign` as highly privileged.

### 7.5 Permission classes

`access_control/permissions.py`:

- `HasPermission(code)` — a factory returning a permission class that checks
  `policy.has_permission(user, code)`; used at view/viewset level.
- `IsBootstrapAllowed` — intended for bootstrap gating (the bootstrap view
  itself uses `AllowAny` plus the signup code).
- `CanManageTargetUser` — object-level check preventing one user from
  modifying or deactivating the protected administrator.
- `CanAccessTodo` — object-level check for to-do mutation; combined with
  viewset queryset scoping.

`DatabaseJWTAuthentication` lives in `access_control/authentication.py`. It
reloads the user each request, so role/permission changes and deactivation
take effect immediately, at the cost of one user query per request.

### 7.6 RBAC management endpoints

All paths are under `/api/v1`.

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/roles/`, `/roles/{id}/` | `roles.read` |
| POST/PATCH/PUT/DELETE | `/roles/`, `/roles/{id}/` | `roles.manage` |
| GET/PUT | `/roles/{id}/permissions/` | `permissions.assign` |
| GET/PUT | `/roles/{id}/menus/` | `menus.assign` |
| GET | `/permissions/`, `/permissions/{id}/` | `permissions.read` |
| POST | `/permissions/` | `permissions.manage` + protected admin |
| PATCH/PUT | `/permissions/{id}/` | `permissions.manage` |
| DELETE | `/permissions/{id}/` | `permissions.manage` |
| GET | `/users/{id}/roles/` | `users.read` |
| PUT | `/users/{id}/roles/` | `roles.assign` |
| GET | `/users/{id}/permission-overrides/` | `permissions.read` |
| PUT | `/users/{id}/permission-overrides/` | `permissions.assign` |

Notable behaviors:

- `DELETE /roles/{id}/` is a soft deactivate (sets `is_active=False` and
  `deleted_at`), not a hard delete. It returns 400 for system roles.
- `DELETE /permissions/{id}/` deactivates custom permissions; system
  permissions are rejected.
- `GET /roles/{id}/permissions/` and `GET /roles/{id}/menus/` require the
  corresponding **assign** permission, not merely read access. A user with
  `roles.read` but not `permissions.assign`/`menus.assign` cannot load the
  role editor's assignment tabs (issue M3).
- `GET /users/{id}/roles/` uses `users.read`; the frontend roles modal
  therefore needs both `users.read` and `roles.assign` to be fully usable.

### 7.7 Seed data

`python manage.py seed_rbac` is idempotent and creates/refreshes:

**Roles**

| Role | Grants |
| --- | --- |
| `administrator` | all 22 registered codes |
| `auditor` | `audit.read`, `audit.export`, `users.read`, `roles.read`, `permissions.read`, `menus.read`, `market.read` |
| `standard_user` | `todos.read`, `todos.create`, `todos.update`, `todos.delete`, `todos.assign`, `market.read` |

**Menus**

| Code | Label | Path | Component key | Required permission |
| --- | --- | --- | --- | --- |
| `dashboard` | Dashboard | `/dashboard` | `DashboardPage` | `market.read` |
| `todos` | To-dos | `/todos` | `TodosPage` | `todos.read` |
| `users` | Users | `/admin/users` | `UsersAdminPage` | `users.read` |
| `roles` | Roles | `/admin/roles` | `RolesAdminPage` | `roles.read` |
| `permissions` | Permissions | `/admin/permissions` | `PermissionsAdminPage` | `permissions.read` |
| `menus` | Menus | `/admin/menus` | `MenusAdminPage` | `menus.read` |
| `audit` | Audit Log | `/admin/audit` | `AuditPage` | `audit.read` |

**Role-menu mappings**: administrator → all seven; auditor → dashboard,
users, roles, permissions, menus, audit (no todos); standard_user → dashboard,
todos.

Because seeding uses `update_or_create` with `is_active=True`,
`is_system=True`, and re-adds role permissions/menus with `get_or_create`,
running `seed_rbac` again re-activates system roles, permissions, and menus
and preserves extra role grants that were added manually (issue L4).

---

## 8. Navigation and dynamic UI

### 8.1 Backend

- Menu definitions are rows in `navigation.Menu`; visibility is a
  role-menu mapping plus an optional required permission.
- `visible_menus_for(user)` in `navigation/services.py`:
  - protected administrator sees every active menu;
  - other users get menus whose `RoleMenu` links to one of their current
    roles (active, not deleted, unexpired) **and** whose
    `required_permission` is empty or effectively held;
  - the result is assembled into a tree rooted at `parent_id=None`, with each
    node serialized as code, label, path, component key, sort order, and
    children.
- `GET /api/v1/navigation/menus/` requires authentication only and returns
  `{"menus": [...]}`.
- `GET /api/v1/auth/me/access/` returns the same tree alongside the
  permission snapshot.
- Menu administration (`/menus/`) requires `menus.read` for reads and
  `menus.manage` for writes. `DELETE` only deactivates (`is_active=False`).
- `MenuSerializer` validates that `component_key` is in
  `navigation/registry.py`'s allowlist and that `required_permission`, when
  set, is a registered catalog code.
- The allowlist contains exactly: `DashboardPage`, `TodosPage`,
  `UsersAdminPage`, `RolesAdminPage`, `PermissionsAdminPage`,
  `MenusAdminPage`, `AuditPage`.

Tree-building caveat: if a parent menu is not visible but a child is allowed,
the child is orphaned and dropped, because the tree is built starting from
roots (`parent_id=None`). There is no "promote orphan to root" behavior
(issue M2).

### 8.2 Frontend routing

`src/app/router.jsx`:

- If setup status is unknown → full-screen "Starting up…" spinner.
- If setup is incomplete → `BootstrapPage` for every path.
- If unauthenticated → login routes (`/login`, plus a redirect to setup when
  applicable).
- If authenticated → routes are generated by flattening the menu tree:
  - each menu with a `component_key` becomes a route at its `path`;
  - `component_key` is resolved through
    `src/app/componentRegistry.jsx`, which uses `React.lazy()` with the same
    seven keys as the backend allowlist;
  - an unknown key renders a configuration `ErrorState`, never an arbitrary
    import;
  - `/` redirects to the first available menu path, falling back to
    `/dashboard`;
  - unmatched paths render `ErrorState`.

The registry and the backend allowlist are maintained by hand and must be
kept in sync; adding a menu component requires changes on both sides.

`src/components/layout/AppLayout.jsx` renders the sidebar plus the active
route. The sidebar renders top-level menus and only one level of `children`.
Deeper nesting is returned by the API but not rendered (issue M2).

`src/features/auth/useAccess.js` queries `/auth/me/access/` while
authenticated, refetches every 30 seconds and on window focus, and exposes
`usePermission()` as a `code => boolean` helper. Combined with the router's
30-second menu refetch, role/permission changes propagate without a reload.

---

## 9. To-dos

### 9.1 State machine

`ALLOWED_TRANSITIONS` in `todos/serializers.py`:

| From | Allowed to |
| --- | --- |
| `open` | `in_progress`, `cancelled` |
| `in_progress` | `open`, `blocked`, `completed`, `cancelled` |
| `blocked` | `in_progress`, `cancelled` |
| `completed` | `open` |
| `cancelled` | `open` |

The same transition rule is enforced in two places: `TodoSerializer.validate_status`
for normal create/update, and the `status` action for the dedicated transition
endpoint. `TodoStatusSerializer` accepts only valid status choices. Transition
validation is skipped when the requested status equals the current status.

### 9.2 Permissions and scoping

- `list`/`retrieve`: `todos.read`.
- `create`: `todos.create`; `owner` and `created_by` are forced to the
  requester.
- `update`/`partial_update`: `todos.update` + `CanAccessTodo`.
- `destroy`: `todos.delete` + `CanAccessTodo`; performs a soft delete.
- `assign`: `todos.assign`.
- `status`: `todos.update`.
- Queryset scoping: protected administrator or `todos.manage` sees all
  non-deleted to-dos; everyone else sees only rows where they are owner or
  assignee. Object-level `CanAccessTodo` adds a second check for mutations.

### 9.3 Assignment

`POST /todos/{id}/assign/` accepts `{"assignee": <user id or null>}`. The
assignee must be an active, non-deleted user. The action audits
`todo_assigned`, sets `updated_by`, and returns the serialized to-do.

Two permission quirks:

- The action's permission classes require `todos.assign` before the action
  body runs. The body contains an owner fallback ("only the owner or a
  delegate can assign") that is therefore unreachable for users without
  `todos.assign` (issue M1).
- `TodoSerializer` exposes `assignee` as a writable field. A user with
  `todos.create` or `todos.update` but **without** `todos.assign` can set or
  change the assignee through create/PATCH, bypassing the dedicated
  assignment permission (issue H3). The serializer does validate that the
  assignee is active and not deleted.

### 9.4 Serialization

`TodoSerializer` returns `id`, `title`, `description`, `status`, `priority`,
`due_at`, `owner` (id), `owner_username`, `assignee` (id),
`assignee_username`, `created_at`, `updated_at`, `deleted_at`. Only `id`,
`owner`, usernames, and timestamps are read-only; `assignee` remains
writable (see above). `validate_assignee` rejects inactive/deleted users.
`validate_status` enforces transitions.

**Frontend**: `TodosPage` provides paginated listing (25/page),
status/priority filters, create/edit modals, a `NEXT_STATUS` advance action,
and delete. There is no assignee picker in the UI, even though the API
supports assignment; assignment is only reachable directly through the API.

---

## 10. Audit trail

### 10.1 Write path

`audit.services.record_audit(actor, action, resource_type, object_id, before,
after)`:

- Reads the request context (`correlation_id`, `ip_address`, `user_agent`).
- Stores `actor` only if authenticated, otherwise `NULL`.
- Converts `object_id` to a string.
- Redacts sensitive values recursively before writing JSON.
- Should be called inside the same transaction as the mutation so both
  commit or roll back together. Most API mutations do this, but not every
  code path wraps `record_audit` in an explicit `transaction.atomic()`;
  where it is not wrapped, the audit row may still commit independently.

Redaction keys (case-insensitive; `-` is normalized to `_` before matching):
`password`, `passwordhash`, `password_hash`, `token`, `access`,
`access_token`, `refresh`, `refresh_token`, `secret`, `secret_key`,
`authorization`, `cookie`, `set-cookie`, `signupcode`, `admin_signup_code`.
Matched values become `[redacted]`; dicts and lists are traversed.

Because keys are normalized by replacing `-` with `_`, the literal key
`Set-Cookie` normalizes to `set_cookie`, which is **not** in the set
(`set-cookie` is). A payload using the hyphenated header name would therefore
not be redacted (issue M7). The same applies to any other hyphenated key
whose normalized form is not also listed.

### 10.2 Recorded actions

Observed in source:

| Action | Resource | Actor |
| --- | --- | --- |
| `bootstrap_admin` | User | new administrator |
| `login_succeeded` | User | user |
| `login_failed` | User | null (`object_id` = username) |
| `user_created` | User | actor |
| `user_updated` | User | actor |
| `user_deactivated` | User | actor |
| `user_roles_updated` | User | actor |
| `user_overrides_updated` | User | actor |
| `role_created` | Role | actor |
| `role_updated` | Role | actor |
| `role_deactivated` | Role | actor |
| `role_permissions_updated` | Role | actor |
| `role_menus_updated` | Role | actor |
| `permission_created` | Permission | actor |
| `permission_updated` | Permission | actor |
| `permission_deactivated` | Permission | actor |
| `menu_created` | Menu | actor |
| `menu_updated` | Menu | actor |
| `menu_deactivated` | Menu | actor |
| `todo_created` | Todo | actor |
| `todo_updated` | Todo | actor |
| `todo_deleted` | Todo | actor |
| `todo_assigned` | Todo | actor |
| `todo_status_changed` | Todo | actor |

Payloads are deliberately minimal (for example, a to-do update stores only
status and assignee before/after), which limits accidental leakage.

### 10.3 Read path

- `GET /api/v1/audit-logs/` requires `audit.read`, is read-only, uses cursor
  pagination (50), orders newest first, supports DRF search over
  `action`, `resource_type`, `object_id`, `actor__username`, and supports
  `action`, `resource_type`, `actor` filters plus explicit `resource_type`,
  `object_id`, and `action` query filters.
- `GET /api/v1/audit-logs/export/` requires `audit.export`, renders CSV with
  id, created_at, actor, action, resource_type, object_id, correlation_id,
  and ip_address, capped at 5,000 rows. It does not include `before`/`after`.
- The audit API cannot be used to modify or delete audit rows.

`RequestContextMiddleware` must be installed for correlation/IP/user-agent
capture; it is last in `MIDDLEWARE`.

---

## 11. Market data

### 11.1 Endpoints

All require `market.read`. All return the underlying payload as JSON and set
`X-Data-Source: live` or `X-Data-Source: mock`.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/v1/market/stock-daily/{symbol}/` | Daily OHLCV series; symbol uppercased and validated |
| GET | `/api/v1/market/sector-performance/` | Sector performance distribution |
| GET | `/api/v1/market/movers/` | Gainers, losers, most active |
| GET | `/api/v1/market/stock-score/{symbol}/` | Composite score from daily data |

Symbol validation uses `^[A-Za-z][A-Za-z0-9.\-]{0,14}$`; invalid symbols
return 400 with `{"error": {"detail": "Invalid symbol."}}`. There is no
server-side time-range parameter; the frontend filters the returned series
client-side.

### 11.2 Live vs mock resolution

`market_data/alpha_vantage.py`:

- Live data is disabled when `USE_MOCK_DATA` is true or
  `ALPHA_VANTAGE_API_KEY` is empty/placeholder (contains `YOUR_`).
- The client treats Alpha Vantage `Error Message`, `Note`, and `Information`
  payloads, empty data, and any request/parse exception as fallback triggers.
- Each fetch returns `{"data": ..., "source": "live"|"mock"}`.
- Failures are converted to a consistent `AlphaVantageError` where
  appropriate; the views return it through the common error envelope.

### 11.3 Caching

`market_data/cache.py` uses the `market_data` cache alias:

- `daily_stock_{SYMBOL}` → daily series.
- `sector_performance`, `market_movers` → singleton payloads.
- `stock_score_{SYMBOL}` → computed score.
- TTL is `MARKET_CACHE_LIVE_TTL` (300 s) for live data and
  `MARKET_CACHE_MOCK_TTL` (60 s) for mock data.
- The whole result (data + source) is cached; there is no partial refresh.
- `invalidate(key)` exists but no scheduled/manual invalidation endpoint is
  exposed.
- Locmem caching means each process has its own cache, so multi-worker
  deployments may serve different vintages and issue more upstream calls.

### 11.4 Mock data

`market_data/mock_data.py` is a deterministic port of the legacy
`backend/utils/mockData.js`:

- Same FNV-1a string hash and mulberry32 PRNG.
- JS `Math.round` behavior emulated (round half up), because Python's
  `round()` uses banker's rounding.
- Base prices include IBM, AAPL, MSFT, GOOGL, AMZN, TSLA; the UI uses those
  six symbols.
- Documented intentional difference: JS labels dates with
  `Date.toISOString()` (UTC) while Python uses local time; the numeric series
  is identical for a given seed.

### 11.5 Scoring

`market_data/scoring.py`:

- Requires at least 20 daily rows; returns `None` otherwise. The score
  endpoint converts `None` into an `AlphaVantageError` ("Insufficient data to
  compute a score").
- Uses the last 20 days.
- Volatility: annualized standard deviation × √252. Score 5 when < 0.2,
  3 when < 0.35, otherwise 1.
- Growth: 5-day growth rate. Score 5 when > 0.02, 3 when > 0, otherwise 1.
- Volume: average volume. Score 5 when > 5,000,000, 3 when > 1,000,000,
  otherwise 1.
- The composite score is derived from these three components (the exact
  weighting is in `stockScoreCalculator` parity; the module mirrors the
  legacy JS implementation).
- A parity test (`tests/parity/score_parity.js`) runs the original Node
  module and compares outputs with the Python implementation.

### 11.6 Frontend consumption

`MarketDashboardPage` offers six symbols (IBM, AAPL, MSFT, GOOGL, AMZN, TSLA)
and ranges 1M/3M/6M/1Y/ALL. It issues four queries (daily series, sectors,
movers, score), displays:

- a line chart for close prices,
- a pie chart for sector performance,
- bar charts for gainers/losers,
- a heatmap card,
- a stock score card,
- a most-active table,
- a latest-OHLCV table.

`src/utils/chartData.js` provides `prepareLineData` (no slicing, no reversal;
keeps chronological order) and `filterByRange` (client-side range filtering).
The 90-point slicing/reversal bug from the legacy chart was fixed here.

---

## 12. Frontend architecture

### 12.1 Boot sequence

`src/main.jsx`:

```
StrictMode
└── QueryClientProvider (src/app/queryClient.js)
    └── BrowserRouter
        └── App (src/App.jsx)
            └── AuthProvider
                └── AppRoutes
```

### 12.2 Auth provider and routing

Covered in §6.5 and §8.2. Two important failure modes:

- If `GET /auth/setup-status/` rejects, `setupComplete` stays `null` and the
  router shows "Starting up…" indefinitely; there is no error UI or retry
  for this state (issue H4).
- The router builds routes only from the server menu tree, so a user without
  a menu entry has no client route for that page. The backend still enforces
  API permissions independently.

### 12.3 HTTP layer

`src/services/http.js`:

- Axios instance with `baseURL = VITE_API_BASE_URL || "/api/v1"`.
- Access token stored in a module variable, attached as
  `Authorization: Bearer <token>`.
- Non-GET requests attach `X-CSRFToken` read from the `csrftoken` cookie.
- Response interceptor: on 401, if the request was not itself the refresh
  call, it triggers a single shared refresh; concurrent 401s await the same
  promise; then the original request is retried once.
- `isRefreshCall` uses a substring test on the request URL, which is fragile
  if the base URL or route naming changes (issue L1).
- `setAuthLostHandler` lets the provider clear user state when refresh fails.
- `ensureCsrfCookie()` calls `/auth/csrf/` best-effort.
- `extractError()` normalizes the backend error envelope for UI messages.
- `auditExportUrl` is exported but not used; the audit page fetches the CSV
  blob directly (issue L2).

`src/services/endpoints.js` is the single API function module and mirrors the
routes in §17. It returns TanStack Query-friendly promises, and for market
endpoints it lifts `X-Data-Source` into `{data, source}`.

### 12.4 Query cache

`src/app/queryClient.js`:

- Defaults: retry 1, stale time 15 s, refetch on window focus, mutation retry
  0.
- Central `queryKeys` for auth (me, access), navigation menus, users, roles,
  permissions, menus, audit, to-dos (list/detail), and market data (daily,
  movers, sectors, score).
- The query cache is cleared on auth loss to prevent cross-user data leaking
  into the next session.

### 12.5 Pages

| Feature | Page | Behavior |
| --- | --- | --- |
| Auth | `LoginPage` | Username/password form; error display; redirects on success |
| Auth | `BootstrapPage` | One-time setup; username/name/email/password/signup code; shows setup-complete state |
| Market | `MarketDashboardPage` | Four queries, range filter, charts, score, tables |
| Todos | `TodosPage` | List/filter/create/edit/delete, status advance; no assignee UI |
| Users | `UsersAdminPage` | Debounced search, create/edit/deactivate, roles modal, overrides modal |
| Roles | `RolesAdminPage` | List, create/edit, permission checklist, menu assignment, deactivate custom roles |
| Permissions | `PermissionsAdminPage` | List, create (protected admin only), edit description, deactivate custom, `is_effective` display |
| Menus | `MenusAdminPage` | CRUD, component-key select, required-permission select, parent select, soft delete |
| Audit | `AuditPage` | Resource-type filter, debounced search, cursor pagination, CSV download |

Admin pages share `AdminChrome` for page headers and table layout; `Ui.jsx`
holds shared modal, button, field, empty-state, and error-state primitives.

### 12.6 Styling

The current application imports only `src/index.css` (from `main.jsx`).
`src/index.css` contains the Tailwind v4 import, minimal body/root styles,
`.admin-page`, and a reduced-motion rule.

The chart/table components (`LineChartCard`, `PieChartCard`, `BarChartCard`,
`HeatmapCard`, `TableComponent`) use global legacy class names such as
`card`, `card-title`, `data-table`, `table-container`, `text-muted`, and
`heatmap-*`. Those classes are defined only in the legacy
`src/styles/Dashboard.css` / `src/App.css`, which the current app never
imports. As a result, the market dashboard renders its charts and tables
without the intended card/table styling (issue H2).

`src/index.html` still uses the Vite placeholders: title `Vite + React` and
favicon `/vite.svg`. It loads the Fira Sans font from Google Fonts. There is
no environment-specific HTML templating.

### 12.7 Legacy and dead code

The following files are present but not reachable from the current
`main.jsx` → `App.jsx` tree:

- `src/context/AuthContext.jsx` — legacy auth context using `localStorage`.
- `src/services/api.js` — legacy API client using `localStorage`
  (`fd_auth_token`) and defaulting to `http://localhost:5000/api`.
- `src/hooks/useFetchData.js` — legacy fetching hook.
- `src/pages/DashboardPage.jsx`, `src/pages/LoginPage.jsx`,
  `src/pages/AdminUsersPage.jsx` — legacy pages.
- `src/components/ProtectedRoute.jsx` — legacy route guard.
- `src/components/DataSourceBanner.jsx` — explicit unused stub returning
  `null`.
- `src/App.css`, `src/styles/Auth.css`, `src/styles/Dashboard.css` — legacy
  styles, unimported.

These files duplicate auth, fetching, and UI concepts; keeping them increases
confusion and the chance that future edits land in dead code. The README and
migration guide also describe some of them as active.

---

## 13. Testing and tooling

### 13.1 Backend

`pytest` is configured with `testpaths = tests` and `pythonpath = . apps`.
The suite under `backend-django/tests/`:

- `conftest.py` — API client fixture, autouse cache clearing, RBAC seeding,
  user factories (`make_user`, `admin_user`), authenticated client, and a
  bootstrap-ready fixture.
- `test_auth.py` — setup status, bootstrap success/410/503, login success and
  failure, lockout, refresh rotation, logout, protected-administrator
  behavior.
- `test_rbac.py` — effective permissions, role grants, overrides
  (allow/deny), delegation invariants, protected-admin protections, menu
  visibility, and "menu grant is not API authorization".
- `test_todos.py` — scoping to owner/assignee, permission checks, assignment,
  inactive-assignee rejection, allowed/invalid transitions, soft delete.
- `test_audit.py` — audit writes, redaction, read-only API, CSV export,
  filters.
- `test_finance.py` — market endpoints under mock data, symbol validation,
  score behavior, `X-Data-Source`.
- `test_legacy_import.py` — dry-run/apply behavior, bcrypt hash prefixing,
  idempotency.
- `tests/parity/score_parity.js` — Node harness invoked by the parity test.

Run with:

```bash
cd backend-django
pytest -c pytest.ini tests
```

The suite requires a reachable MySQL test database; it is not a SQLite-only
suite.

### 13.2 Frontend

- `npm test` → `vitest run`; `npm run test:watch` → `vitest`.
- `npm run lint` → ESLint flat config.
- `npm run build` → production Vite build.
- `src/test/setup.js` imports `@testing-library/jest-dom/vitest`.
- The only test file is `src/utils/chartData.test.js`, covering
  `prepareLineData` (no slicing/reversal) and `filterByRange` behavior,
  including empty input.

There are no component, integration, or end-to-end tests. `docs/MIGRATION.md`
claims tests exist for `flattenMenus` and `extractError`; those tests are not
present in the repository (issue L3).

### 13.3 Management commands

- `python manage.py seed_rbac` — idempotent RBAC/menu seeding (22 permissions,
  3 roles, 7 menus).
- `python manage.py import_legacy_users` — dry-run by default; `--apply`
  writes. It reads legacy JSON users, prefixes raw bcrypt hashes with
  `bcrypt$` so Django's `BCryptPasswordHasher` can verify them, skips
  existing users, and marks the setup state when appropriate.

The import command references `backend/data/users.json`, which is not present
in this repository (issue H1), so the command cannot run as documented.

---

## 14. SQL operator access layer

`backend-django/sql/operator_access.sql` provides MySQL views and stored
procedures for read-only/limited operator access (for example from MySQL
Workbench). It intentionally mirrors the application's authorization
precedence:

1. inactive/soft-deleted users have no permissions;
2. protected administrators implicitly hold all registered codes;
3. role grants require active role, non-deleted role, unexpired user-role,
   active permission, and registered code;
4. `DENY` overrides remove, `ALLOW` overrides add;
5. unregistered codes are ignored.

Operational notes:

- Views/procedures use `SQL SECURITY INVOKER`, so the connecting account needs
  `CREATE ROUTINE`/`CREATE VIEW` to install and DML grants on the underlying
  tables to use them.
- The SQL layer must be updated whenever the catalog changes; it does not
  replace Django authorization, and direct writes bypass audit logging.
- The application's API remains the only supported way to mutate privileged
  data.

---

## 15. Configuration and operations

### 15.1 Environment variables (names only)

Backend (variables read by `config/settings.py`; `.env.example` documents the
common subset):

| Group | Variables |
| --- | --- |
| Django | `DJANGO_ENV`, `DJANGO_DEBUG`, `DJANGO_SECRET_KEY`, `DJANGO_ALLOWED_HOSTS`, `DJANGO_TIME_ZONE`, `DJANGO_CORS_ALLOWED_ORIGINS`, `DJANGO_CSRF_TRUSTED_ORIGINS`, `DJANGO_SECURE_SSL_REDIRECT`, `DJANGO_HSTS_SECONDS`, `DJANGO_LOG_DIR` |
| Bootstrap | `ADMIN_SIGNUP_CODE` |
| Database | `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, `DB_TEST_NAME`, `DB_CONN_MAX_AGE` |
| JWT/cookies | `JWT_ACCESS_MINUTES`, `JWT_REFRESH_DAYS`, `REFRESH_COOKIE_NAME`, `REFRESH_COOKIE_PATH`, `REFRESH_COOKIE_SECURE`, `REFRESH_COOKIE_SAMESITE` |
| Market | `ALPHA_VANTAGE_API_KEY`, `ALPHA_VANTAGE_TIMEOUT`, `USE_MOCK_DATA`, `MARKET_CACHE_LIVE_TTL`, `MARKET_CACHE_MOCK_TTL` |
| Throttling | `THROTTLE_LOGIN`, `THROTTLE_BOOTSTRAP`, `THROTTLE_REFRESH` |

Defaults are listed in §4.1. The real `.env` was not read; treat it as the
authoritative deployment configuration.

Frontend:

- `VITE_API_BASE_URL` — optional; defaults to `/api/v1` in
  `src/services/http.js`. The root README claims a `.env.local` sets it, but
  no `.env.local` exists in the frontend directory (issue L6).

### 15.2 Run commands (from READMEs)

Backend:

```bash
cd backend-django
python -m venv .venv
.venv/Scripts/activate        # Windows
pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py seed_rbac
python manage.py runserver 127.0.0.1:8000
```

Frontend:

```bash
cd financial-dashboard-frontend
npm install
npm run dev        # http://localhost:5173, proxies /api to :8000
npm run build
npm run lint
npm test
```

Production notes:

- `gunicorn` is installed only on non-Windows platforms; Windows production
  would need a different WSGI server (the migration guide mentions
  `waitress`, which is not in `requirements.txt`).
- Static files for the Django admin require a separate web server or
  additional static middleware; no WhiteNoise/CDN configuration exists.
- Locmem caches are per-process; use Redis/another shared cache for
  multi-worker deployments if cache consistency or global throttling
  matters.
- Refresh cookie `Secure` defaults to on when `DEBUG=false`; TLS termination
  and `SECURE_PROXY_SSL_HEADER` are configured for a reverse proxy.

### 15.3 Health and observability

- `GET /api/health/` is unauthenticated and performs a database round trip;
  it is suitable for liveness/readiness probes.
- Request correlation ids are generated/accepted and echoed in
  `X-Request-ID`; they are stored on audit rows.
- Logging goes to console and `logs/app.log` (rotating). No metrics,
  tracing, or error-reporting integration is configured.

---

## 16. Known issues and risks

Severity reflects impact on correctness, security, or operability, not effort.

### High

**H1 — Legacy backend referenced by documentation is missing.**
`README.md` and `docs/MIGRATION.md` describe `backend/` (Express) and
`backend/data/users.json` as preserved for rollback, and
`import_legacy_users` reads that JSON. Neither the directory nor the JSON file
exists in this repository. Rollback as documented is impossible, and the
import command cannot run.
Files: `README.md`, `docs/MIGRATION.md`, `backend-django/README.md`,
`backend-django/apps/accounts/management/commands/import_legacy_users.py`.

**H2 — Market dashboard is partially unstyled.**
The new app imports only `src/index.css`. Legacy chart/table components rely
on classes defined in unimported `src/styles/Dashboard.css` and `src/App.css`
(`card`, `card-title`, `data-table`, `table-container`, `text-muted`,
`heatmap-*`). Charts/tables render without their intended card, table, and
heatmap styles.
Files: `src/main.jsx`, `src/index.css`, `src/components/*ChartCard*.jsx`,
`src/components/TableComponent.jsx`, `src/styles/Dashboard.css`,
`src/App.css`.

**H3 — `todos.assign` can be bypassed through the to-do serializer.**
`assignee` is writable on create/update. A user with `todos.create` or
`todos.update` but without `todos.assign` can set/change the assignee via
`POST /todos/` or `PATCH /todos/{id}/`. The dedicated `/assign/` endpoint is
properly gated, but the serializer is not.
Files: `apps/todos/serializers.py`, `apps/todos/views.py`.

**H4 — Auth bootstrap can hang on a failed setup-status call.**
If `GET /auth/setup-status/` rejects, `setupComplete` remains `null` and the
router renders "Starting up…" forever with no retry or error state.
Files: `src/features/auth/AuthProvider.jsx`, `src/app/router.jsx`.

### Medium

**M1 — Owner assignment fallback is dead code.**
`TodoViewSet.assign` requires `todos.assign` at the permission-class level,
so the in-body owner fallback can never execute. Owners without
`todos.assign` cannot assign, despite the error message implying otherwise.
Files: `apps/todos/views.py`.

**M2 — Menu nesting is only partially supported.**
`AppLayout` renders top-level plus one child level; deeper levels are
dropped. `visible_menus_for` drops a visible child whose parent is not
visible. The UI therefore cannot represent arbitrary menu depth even though
the model supports it.
Files: `apps/navigation/services.py`, `src/components/layout/AppLayout.jsx`.

**M3 — Role assignment tabs require assign permissions to read.**
`GET /roles/{id}/permissions/` requires `permissions.assign` and
`GET /roles/{id}/menus/` requires `menus.assign`. A read-only role viewer
cannot inspect a role's grants, which also makes the frontend role editor
partially unusable for `roles.read` users.
Files: `apps/access_control/views.py`, `src/features/roles/RolesAdminPage.jsx`.

**M4 — Last-administrator guard ignores role expiry.**
`_active_administrator_count()` and `_is_last_active_admin()` count users with
the `administrator` role without checking `UserRole.expires_at`. An expired
assignment is counted as an active administrator, which can leave the system
with no usable administrator while the guard still reports one.
Files: `apps/access_control/views.py`, `apps/accounts/api.py`,
`apps/access_control/policy.py`.

**M5 — Successful login does not reset the lockout counter.**
Failures within the 15-minute window remain counted after a success, so a
user can be locked out shortly after a valid login if they had prior
failures. The lockout is also keyed to username+IP, so changing IP resets it.
Files: `apps/accounts/services.py`, `apps/accounts/views.py`.

**M6 — Documentation overstates CSRF coverage.**
`backend-django/README.md` says login, refresh, and logout are CSRF-protected;
only refresh and logout are. Login and bootstrap are unauthenticated and rely
on throttling plus the signup code, not CSRF.
Files: `backend-django/README.md`, `apps/accounts/views.py`.

**M7 — Audit redaction misses hyphenated header keys.**
Keys are lowercased and `-` is replaced with `_` before matching, but
`SENSITIVE_KEYS` contains `set-cookie` (with a hyphen) and not `set_cookie`.
A payload keyed `Set-Cookie` normalizes to `set_cookie` and is not redacted.
Files: `apps/audit/services.py`.

**M8 — Bootstrap masks non-bootstrap integrity errors.**
Any `IntegrityError` during user creation is converted to
`AlreadyBootstrapped`. The serializers pre-check duplicate username/email, so
this mainly affects races and other constraint violations; a concurrent
duplicate or unexpected constraint failure is reported as "Setup is already
complete" (410) instead of a validation error. The 503 `not_configured` branch
is also unreachable because the serializer rejects an empty signup code first.
Files: `apps/accounts/services.py`, `apps/accounts/serializers.py`,
`apps/accounts/views.py`.

**M9 — Overrides can strip a non-protected administrator without a last-admin check.**
`UserPermissionOverridesView` rejects overrides only for the protected
administrator and otherwise applies them without verifying that the target is
the last active administrator. A non-protected user holding the
`administrator` role can therefore have DENY overrides applied, potentially
leaving no usable administrator. The guard exists for role removal and user
deactivation but not for overrides.
Files: `apps/access_control/views.py`.

**M10 — System roles/permissions can be deactivated through PATCH.**
`RoleViewSet.destroy` and `PermissionViewSet.destroy` refuse system entities,
and `PermissionViewSet.perform_update` protects only `code`/`resource`/
`action`. The serializers expose `is_active`, so a PATCH with
`{"is_active": false}` deactivates a system role or system permission,
bypassing the DELETE guard. The next `seed_rbac` run re-activates it.
Files: `apps/access_control/serializers.py`, `apps/access_control/views.py`.

### Low

**L1 — Refresh detection uses a URL substring.**
`isRefreshCall` tests whether the request URL includes the refresh path. A
base-URL change or a route that happens to contain the substring could
misclassify a request and cause an extra refresh attempt or a missed one.
Files: `src/services/http.js`.

**L2 — Unused export helper; export logic duplicated.**
`auditExportUrl` is exported but unused; the audit page builds its own blob
request. This invites drift between the two.
Files: `src/services/endpoints.js`, `src/features/audit/AuditPage.jsx`.

**L3 — Migration guide describes tests that do not exist.**
`docs/MIGRATION.md` claims Vitest coverage for `flattenMenus` and
`extractError`; only `chartData` is tested. It also says routes are built from
`/auth/me/access/`, while the router consumes `/navigation/menus/`.
Files: `docs/MIGRATION.md`, `src/app/router.jsx`, `src/utils/chartData.test.js`.

**L4 — Re-seeding reactivates system entities.**
`seed_rbac` uses `update_or_create` with active/system defaults and re-adds
role-menu/role-permission links. Deactivating a system menu/permission/role
and then re-running the command silently reactivates it, and extra manual
role grants are preserved rather than reset.
Files: `apps/access_control/seed.py`.

**L5 — Role delete endpoint has dead code and misleading error text.**
`RoleViewSet.destroy` assigns `role.deleted_at = role.updated_at` and then
immediately overwrites it with `timezone.now()`. The system-role rejection
says "cannot be deactivated" for a DELETE request. The endpoint is a soft
deactivate, which may surprise API consumers expecting deletion.
Files: `apps/access_control/views.py`.

**L6 — Frontend env documentation is inaccurate.**
The root README says `.env.local` already sets `VITE_API_BASE_URL=/api/v1`,
but no `.env.local` exists. The code default makes this harmless today, but
the documented setup step is misleading.
Files: `README.md`, `src/services/http.js`.

**L7 — Placeholder HTML metadata.**
`index.html` keeps the Vite title and favicon. This is cosmetic but visible in
production.
Files: `index.html`.

**L8 — Dead legacy frontend code remains.**
Legacy auth context, API client, fetching hook, routes, and CSS are still in
the tree and referenced by stale docs. This increases the chance of editing
inactive code and obscures the real architecture.
Files: `src/context/AuthContext.jsx`, `src/services/api.js`,
`src/hooks/useFetchData.js`, `src/pages/`, `src/components/ProtectedRoute.jsx`,
`src/components/DataSourceBanner.jsx`, `src/App.css`, `src/styles/`.

**L9 — Empty `.qodo` directories.**
`.qodo/agents/` and `.qodo/workflows/` exist but are empty. No tool behavior
is configured there.

---

## 17. Appendix A — API reference

Prefix: `/api/v1`. All endpoints require an access token unless marked public.
The error envelope is described in §4.4.

### Authentication

| Method | Path | Access |
| --- | --- | --- |
| GET | `/auth/setup-status/` | public |
| POST | `/auth/bootstrap/` | public + signup code |
| POST | `/auth/login/` | public |
| POST | `/auth/token/refresh/` | public + refresh cookie + CSRF |
| POST | `/auth/logout/` | public + CSRF |
| GET | `/auth/csrf/` | public |
| GET | `/auth/me/` | authenticated |
| GET | `/auth/me/access/` | authenticated |

### Users

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/users/` | `users.read` |
| POST | `/users/` | `users.create` |
| GET | `/users/{id}/` | `users.read` |
| PATCH/PUT | `/users/{id}/` | `users.update` + `CanManageTargetUser` |
| DELETE | `/users/{id}/` | `users.deactivate` + `CanManageTargetUser` |
| GET | `/users/{id}/roles/` | `users.read` |
| PUT | `/users/{id}/roles/` | `roles.assign` |
| GET | `/users/{id}/permission-overrides/` | `permissions.read` |
| PUT | `/users/{id}/permission-overrides/` | `permissions.assign` |

`DELETE /users/{id}/` soft-deletes (sets `deleted_at`, `is_active=False`) and
refuses self-deactivation and protected-admin deactivation.

### Roles and permissions

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/roles/`, `/roles/{id}/` | `roles.read` |
| POST | `/roles/` | `roles.manage` |
| PATCH/PUT | `/roles/{id}/` | `roles.manage` |
| DELETE | `/roles/{id}/` | `roles.manage` (soft deactivate; system roles rejected) |
| GET | `/roles/{id}/permissions/` | `permissions.assign` |
| PUT | `/roles/{id}/permissions/` | `permissions.assign` |
| GET | `/roles/{id}/menus/` | `menus.assign` |
| PUT | `/roles/{id}/menus/` | `menus.assign` |
| GET | `/permissions/`, `/permissions/{id}/` | `permissions.read` |
| POST | `/permissions/` | `permissions.manage` + protected admin |
| PATCH/PUT | `/permissions/{id}/` | `permissions.manage` |
| DELETE | `/permissions/{id}/` | `permissions.manage` (soft deactivate; system permissions rejected) |

### Navigation

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/navigation/menus/` | authenticated |
| GET | `/menus/`, `/menus/{id}/` | `menus.read` |
| POST | `/menus/` | `menus.manage` |
| PATCH/PUT | `/menus/{id}/` | `menus.manage` |
| DELETE | `/menus/{id}/` | `menus.manage` (soft deactivate) |

### To-dos

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/todos/`, `/todos/{id}/` | `todos.read` + scoped queryset |
| POST | `/todos/` | `todos.create` |
| PATCH/PUT | `/todos/{id}/` | `todos.update` + `CanAccessTodo` |
| DELETE | `/todos/{id}/` | `todos.delete` + `CanAccessTodo` |
| POST | `/todos/{id}/assign/` | `todos.assign` |
| POST | `/todos/{id}/status/` | `todos.update` |

### Audit

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/audit-logs/` | `audit.read` |
| GET | `/audit-logs/{id}/` | `audit.read` |
| GET | `/audit-logs/export/` | `audit.export` |

### Market

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/market/stock-daily/{symbol}/` | `market.read` |
| GET | `/market/sector-performance/` | `market.read` |
| GET | `/market/movers/` | `market.read` |
| GET | `/market/stock-score/{symbol}/` | `market.read` |

### Health (outside `/api/v1`)

| Method | Path | Access |
| --- | --- | --- |
| GET | `/api/health/` | public |

---

## 18. Appendix B — Permission-to-capability summary

| Capability | Codes involved |
| --- | --- |
| View users | `users.read` |
| Create users | `users.create` |
| Edit users | `users.update` (+ object protection) |
| Deactivate users | `users.deactivate` (+ object protection) |
| View roles | `roles.read` |
| Create/edit/deactivate custom roles | `roles.manage` |
| Assign roles to users | `roles.assign` (+ delegation) |
| View permission definitions | `permissions.read` |
| Create/edit/deactivate permission definitions | `permissions.manage` (create also protected admin) |
| Assign permissions to roles / overrides | `permissions.assign` (+ delegation) |
| View menus (admin) | `menus.read` |
| Create/edit/deactivate menus | `menus.manage` |
| Assign menus to roles | `menus.assign` (+ delegation) |
| View to-dos in scope | `todos.read` |
| Create to-dos | `todos.create` |
| Update to-dos | `todos.update` (+ scope) |
| Delete to-dos | `todos.delete` (+ scope) |
| Assign to-dos | `todos.assign` (bypassable via serializer today) |
| See/manage all to-dos | `todos.manage` |
| View audit log | `audit.read` |
| Export audit log | `audit.export` |
| Access market data | `market.read` |

Implicit: an active protected administrator holds all 22 codes.

---

## 19. Appendix C — Key invariants checklist

Use this as a review/test checklist when changing the system:

1. Never trust `is_staff`/`is_superuser` for application authorization; only
   the policy resolver decides.
2. Never introduce a second permission-computation path; extend
   `access_control.catalog` and `policy` instead.
3. A new permission code must be added to the catalog, seeded, and (if it
   gates a page) wired to a menu and the SQL operator layer.
4. A new page component must be added to both
   `navigation/registry.py` and `src/app/componentRegistry.jsx`.
5. Never allow a non-protected user to modify the protected administrator or
   to grant authority they do not hold.
6. Never bypass the to-do transition map; both the serializer and the
   `status` action must agree.
7. Never physically delete users, roles, or to-dos through the API.
8. Never return refresh tokens in JSON; only the HttpOnly cookie.
9. Never log or audit raw passwords, tokens, hashes, cookies, or signup
   codes.
10. Keep `X-Data-Source` intact on market responses so the UI can indicate
    live vs mock data.
11. Keep the refresh cookie on `/api/v1/auth/` (or update the CSRF/proxy
    setup accordingly).
12. When changing role/permission behavior, update
    `sql/operator_access.sql` so operator views stay consistent.

---

## 20. Appendix D — Glossary

- **Registered permission** — a permission code present in
  `access_control/catalog.py`; only these are enforceable.
- **Effective permissions** — the set computed by
  `access_control/policy.py` from active roles plus allow/deny overrides,
  or all codes for a protected administrator.
- **Protected administrator** — the single bootstrap account with
  `is_protected_admin=True`; immutable from other accounts and implicitly
  fully privileged.
- **System role / system permission** — seeded entities with `is_system=True`;
  they cannot be deleted/deactivated through the API.
- **Role-menu mapping** — `RoleMenu`; controls navigation visibility, not API
  authorization.
- **Required permission** — optional `Menu.required_permission`; a second
  gate for menu visibility in addition to the role-menu mapping.
- **Component key** — allowlisted string that maps a menu to a lazy-loaded
  frontend page component.
- **Access snapshot** — response of `/auth/me/access/` containing permission
  codes, protected-admin flag, and visible menus.
- **Correlation id** — per-request id used in logs and audit rows.
- **X-Data-Source** — response header indicating whether market data came
  from Alpha Vantage (`live`) or the deterministic mock (`mock`).

---

### Verification status

This review was produced by static inspection only. The following were not
executed and should be verified in a working environment:

- `pytest -c pytest.ini tests`
- `npm test`, `npm run lint`, `npm run build`
- `python manage.py showmigrations`
- `python manage.py seed_rbac` idempotency
- End-to-end bootstrap → login → RBAC → market dashboard flows against a
  real MySQL instance

The real `backend-django/.env` was intentionally not read, so deployed values
for secrets, database credentials, CORS origins, and cookies are unknown to
this document.
