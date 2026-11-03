# PLAN: Migration to RBAC-Enabled Dashboard with Django + DRF + MySQL, React + Tailwind + TanStack Query

**Status:** PLANNING ONLY - No code changes to be made. This document is for review and approval.

---

## STEP 1: EXPLORE THE PROJECT (Current State)

### 1.1 What Exists Today

**Root (`C:/Users/LENOVO/Desktop/final analysis/MERN-Financial-Analytics-Dashboard/`)**
- `.git/` - Git repository
- `backend/` - Express.js API (current)
- `financial-dashboard-frontend/` - React + Vite frontend (current)
- `Financial Dashboard.mp4` - Media asset
- `README.md` - Project documentation
- `package-lock.json` (root-level)

**Backend (Express.js 5, CommonJS) - `backend/`**
- **Entry:** `server.js` - CORS for `http://localhost:5173`, JSON parsing, routes
- **Auth:** JWT (`jsonwebtoken`), bcryptjs for hashing
- **Controllers:** `authController.js`, `financeController.js`, `userController.js`
- **Routes:** `authRoutes.js`, `financeRoutes.js`, `userRoutes.js`
- **Middleware:** `auth.js` (`authenticate`, `requireAdmin`)
- **Utils:** `userStore.js` (file-based JSON), `alphaVantage.js`, `mockData.js`, `stockScoreCalculator.js`, `cache.js`
- **Config:** `db.js` - UNUSED STUB (notes JSON file storage)
- **Data:** `data/users.json` - 2 users: `harshit` (admin), `atharva` (user) with bcrypt hashes
- **Env:** `.env` present (PORT, ALPHA_VANTAGE_API_KEY, USE_MOCK_DATA, JWT_SECRET, ADMIN_SIGNUP_CODE)

**Current Auth (verified):**
- `GET /api/auth/status` - returns `{ adminCreated: boolean }`
- `POST /api/auth/signup` - creates first admin only if none exists and valid `ADMIN_SIGNUP_CODE`; min username 3, password 6; returns JWT+user
- `POST /api/auth/login` - validates credentials; returns JWT+user
- `GET /api/auth/me` - returns current user from token
- Finance routes require `authenticate`
- User management requires `authenticate` + `requireAdmin`
- JWT secret has insecure fallback; token stored in localStorage on frontend
- File-based storage with synchronous fs operations

**Frontend (React 19 + Vite) - `financial-dashboard-frontend/`**
- **Deps:** React 19, Vite 6, react-router-dom 7, axios, recharts, react-select, date-fns, react-tooltip
- **No Tailwind, no TanStack Query** (uses custom `useFetchData` hook)
- **Structure:** components/, pages/, context/, services/, hooks/, styles/
- **Auth:** `AuthContext.jsx` manages token in localStorage, 401 handler; `LoginPage.jsx` checks setup status; `ProtectedRoute.jsx` guards routes
- **API:** `services/api.js` with axios interceptors

**Database:** None (JSON file). Target: MySQL.

### 1.2 Reusable vs Missing

**Reusable:** Auth context, ProtectedRoute, API service pattern, login page structure, admin users page (to refactor)
**Missing vs Required:** Django+DRF backend, MySQL, TanStack Query, Tailwind CSS, full RBAC (roles/permissions/menus/mappings), audit logs, todo module, setup flow with race protection, dynamic menus/routes, httpOnly cookie auth with rotation, CSRF/rate limiting/lockout, soft deletes

### 1.3 Assumptions
- Replace Express/MERN with Django+DRF+MySQL, React+Tailwind+TanStack Query
- Financial analytics features may coexist or be refactored; focus is on RBAC/todo/setup as specified
- MySQL available; Django environment to be set up
- Migration of existing users.json needs handling (password rehashing required)

---

## STEP 2: TARGET STACK

| Technology | Current | Target | Action | Rationale |
|---|---|---|---|---|
| Frontend | React 19 + Vite | React 19 + Vite | Keep | Modern, compatible |
| Styling | CSS files | Tailwind CSS | Add | Required |
| Data Fetching | Custom `useFetchData` | TanStack Query v5 | Add | Required for caching/invalidation/optimistic updates |
| Backend | Express 5 (CommonJS) | Django 5.x + DRF | Replace | Required; ORM, permissions, validation |
| DB | JSON file | MySQL 8.x | Replace | Required for relational RBAC with constraints/indexes |
| Auth | JWT in localStorage | JWT access+refresh in httpOnly cookies | Replace | More secure per requirements |
| Password Hashing | bcryptjs | Argon2 or Django PBKDF2 | Upgrade | Stronger hashing; Django default PBKDF2 secure |

---

## STEP 3: CHANGES TO PLAN

### 3.1 First-Run Admin Sign-Up
- **Setup status:** `GET /api/auth/setup-status/` → `{ setup_complete: bool }` (true if any admin/superuser exists)
- **First-run signup:** `POST /api/auth/setup-admin/` 
  - Enforce with DB-level check inside transaction; use `select_for_update()` to prevent race conditions
  - Validate password strength; create superuser/admin with Argon2/PBKDF2
  - Return tokens in httpOnly cookies or appropriate response
- **Post-setup:** No public signup; only login for all users
- **Frontend:** Call setup-status on mount; route to `/setup-admin` only if not complete; block setup route if complete

### 3.2 Admin Management (CRUD)
Entities: Users (name/username, password, active/inactive), Roles, Rights/Permissions, Menus/Pages, Role-to-Rights, Role-to-Menu, User-to-Role, Activity Logs (who/what/when, before/after JSON)
- Enforce via DRF permission classes
- Protect last admin (cannot disable/delete last active admin)
- Delegates cannot grant more than they hold; cannot edit admin users; cannot remove last admin

### 3.3 Role-Based Access Control
- Every endpoint must enforce permissions (no token-only trust)
- JWT carries only identity (user_id/session); permissions fetched from DB
- Short-lived backend cache for permissions with explicit invalidation on RBAC changes (MySQL no LISTEN/NOTIFY)
- Frontend: dynamic menu and permission-based routes; hide UI elements if lacking permission (backend remains source of truth)

### 3.4 To-Do Module
Fields: title, description, status, priority, due_date, owner (FK), assignee (FK), is_deleted, timestamps
- Admin: full CRUD on all
- Others: only as permitted by rights (enforce in queryset/permissions)

### 3.5 Database as Source of Truth
- Read permissions from DB on critical checks
- React Query with staleTime/cacheTime and explicit invalidation
- Polling/refetch on focus/mutations (SSE optional); DB changes via SQL/Workbench reflected on next API call
- Short permission cache on backend with explicit invalidation

---

## STEP 4: AUTH AND PERFORMANCE REQUIREMENTS

### 4.1 Authentication
- **JWT strategy:** access (short, e.g. 5-15 min) + refresh (longer, e.g. 7-30 days) in httpOnly Secure SameSite cookies
- **Rotation:** refresh token one-time use, revoked on logout; store refresh tokens in DB
- **Hashing:** Argon2 via `argon2-cffi` or Django PBKDF2
- **Validation:** Django AUTH_PASSWORD_VALIDATORS
- **Security:** CSRF protection, CORS restricted, rate limiting on login, account lockout, secure logout + revocation
- **Secrets:** in environment variables; soft deletes; audit logging

### 4.2 Performance
- Django ORM: `select_related`/`prefetch_related`, `only()`/`defer()`, proper indexes
- DRF pagination, filtering, search on lists
- Permission cache with explicit invalidation
- React Query caching + invalidation, code splitting, lazy routes
- Known current issues to address conceptually: sync fs in userStore.js (blocking), unbounded Map cache, line chart slice quirk

---

## STEP 5: PLAN.md STRUCTURE (Full Contents)

The plan includes: 1) Current analysis (reusable/refactor/new, 2) Target architecture (text diagram), 3) DB design (tables/columns/types/keys/constraints/indexes + migration from users.json), 4) Backend plan (Django apps, models/serializers/viewsets/permissions/middleware + full API endpoint table), 5) Frontend plan (structure, dynamic menu, permission-based routing, TanStack Query setup, Tailwind), 6) Sign-up lockout and login flow step-by-step, 7) Audit logging design, 8) Security checklist, 9) Phased implementation roadmap (tasks per phase, files to create/change, dependencies, checkpoints), 10) Testing strategy, 11) Risks/edge cases/open questions.

---

**Next Step:** Review this PLAN.md and approve before any implementation begins.
