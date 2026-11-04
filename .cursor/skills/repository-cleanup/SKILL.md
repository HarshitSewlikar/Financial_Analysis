---
name: repository-cleanup
description: Read-only cleanup audit for this React, Vite, Django REST Framework, and Microsoft SQL Server repository. Use when identifying unused files, unused dependencies, duplicate implementations, obsolete configuration, abandoned endpoints, or generated artifacts. Recommend cleanup only. Do not rewrite queries, change indexes, or modify caching. Delete or edit only after the user approves that specific item.
---

# Repository Cleanup

## Objective

Find unused or duplicate material and classify it. The initial audit is completely read-only. A request to audit is not approval to delete.

Recommend cleanup only. Do not rewrite queries, change indexes, or modify caching. Those belong to `performance-audit`.

## Project layout

Paths below are relative to the git repository root (the directory that contains these folders). Verify the repository before relying on this list.

- Frontend: `financial-dashboard-frontend/`.
- Backend: `backend-django/`.
- Requirements: `backend-django/requirements.txt` and `backend-django/requirements-sqlserver.txt`.
- SQL Server settings: `backend-django/config/settings_sqlserver.py`. MySQL configuration remains in `backend-django/config/settings.py`.
- Keep that MySQL configuration and `backend-django/scripts/transfer_mysql_to_sqlserver.py` until runtime, deployment, testing, and migration dependencies are verified.
- Tests to preserve: `backend-django/tests/test_rbac.py` and `backend-django/tests_sqlserver/`.

## Safety

The initial audit is completely read-only. Do not edit files, run migrations, or write to the database.

- Never execute migrations against the existing SQL Server database during an audit.
- Before any database testing, verify the active Django settings module and the database target.
- Run automated tests only against an isolated test database, never the existing SQL Server database.
- A SQL Server `.bak` backup is required before any approved schema-changing operation. Do not start that operation until the backup exists and the user has approved the specific change.
- Do not modify SQL Server data or reset the database.
- Do not delete migration history or edit existing migration files.
- Protect `accounts.User` and `AUTH_USER_MODEL`.
- Protect JWT authentication and refresh-token settings, including `SIMPLE_JWT`, `ROTATE_REFRESH_TOKENS`, and `REFRESH_COOKIE_*`.
- Protect RBAC models, permission policies, and seed data.
- Protect frontend route guards.
- Protect `backend-django/tests/test_rbac.py` and `backend-django/tests_sqlserver/`.
- Do not classify similar permission checks as duplicates unless you prove they are functionally equivalent.
- Do not reorganize directories for appearance.
- Do not expose secrets from `.env` files.
- Do not delete `node_modules`, `dist`, `__pycache__`, or caches that a build, deploy, or local setup still needs. Recommend `.gitignore` updates when generated files are tracked.

## Unused means unreferenced

Before calling something unused, search all of these:

- Static imports and `React.lazy` / `import()`, including `financial-dashboard-frontend/src/app/componentRegistry.jsx`.
- React routes, Django `path` and `include`, DRF `router.register`, and string view references.
- `INSTALLED_APPS`, middleware dotted paths, settings references, `AppConfig`, signals, and management commands.
- `backend-django/scripts/`, deployment config, both requirements files, and tests.
- Runtime, deployment, testing, and migration references before treating MySQL settings or `scripts/transfer_mysql_to_sqlserver.py` as removable.

## Report

For each item: path, evidence, risk (`Safe to remove`, `Requires further investigation`, `Potentially breaking`, `Must preserve`), and the exact action you will not take until approved.

Cover unused files, unused dependencies, duplicate code that shares the same responsibility, obsolete configuration, generated artifacts, and database or migration risks.

Permission checks stay in `Must preserve` until functional equivalence is proven.

## Implementation

Start only after the user approves specific items. Use a git checkpoint. Make one reversible change at a time.

- Confirm a SQL Server `.bak` backup before any schema-changing operation.
- Verify the active Django settings module and database target. Use an isolated test database for automated tests.
- Do not execute migrations against the existing SQL Server database.

Then run the frontend production build, frontend tests, backend tests against the isolated test database, Django system checks, API endpoint checks, SQL Server connectivity, auth and RBAC tests, and a git diff review. Existing behavior must remain.
