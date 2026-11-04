---
name: performance-audit
description: Audit performance of this React, Vite, Django REST Framework, and Microsoft SQL Server application. Use when investigating slow pages, API latency, excessive database queries, bundle size, rendering cost, or SQL Server execution plans. Recommend performance-related fixes only. Do not delete files or remove dependencies. Implement a fix only after the user approves that specific finding.
---

# Performance Audit

## Objective

Identify measurable bottlenecks and recommend performance fixes. The initial audit is completely read-only. A request to audit is not approval to edit.

Recommend performance-related changes only. Do not delete files or remove dependencies. Those belong to `repository-cleanup`.

## Project layout

Paths below are relative to the git repository root (the directory that contains these folders). Verify the repository before relying on this list.

- Frontend: `financial-dashboard-frontend/` (React, Vite, JavaScript, Tailwind CSS, Axios). Route screens load through `React.lazy` in `financial-dashboard-frontend/src/app/componentRegistry.jsx`.
- Backend: `backend-django/` (Django, Django REST Framework).
- Database: Microsoft SQL Server via `backend-django/config/settings_sqlserver.py` (`ENGINE: mssql`) and `backend-django/requirements-sqlserver.txt`. `backend-django/config/settings.py` still contains a MySQL engine. Keep that MySQL configuration and `backend-django/scripts/transfer_mysql_to_sqlserver.py` until runtime, deployment, testing, and migration dependencies are verified.
- Dependencies: `backend-django/requirements.txt` and `backend-django/requirements-sqlserver.txt`.

## Safety

The initial audit is completely read-only. Do not edit files, run migrations, or write to the database.

- Never execute migrations against the existing SQL Server database during an audit.
- Before any database testing, verify the active Django settings module and the database target.
- Run automated tests only against an isolated test database, never the existing SQL Server database.
- A SQL Server `.bak` backup is required before any approved schema-changing operation. Do not start that operation until the backup exists and the user has approved the specific change.
- Do not modify SQL Server data or reset the database.
- Do not edit existing migration files. New indexes are recommendations only. Add one only as a new migration after explicit approval and a verified `.bak` backup.
- Protect `accounts.User` and `AUTH_USER_MODEL`.
- Protect JWT authentication and refresh-token settings, including `SIMPLE_JWT`, `ROTATE_REFRESH_TOKENS`, and `REFRESH_COOKIE_*`.
- Protect RBAC models, permission policies, and seed data.
- Protect frontend route guards.
- Protect `backend-django/tests/test_rbac.py` and `backend-django/tests_sqlserver/`.
- Do not expose secrets from `.env` files.
- Do not rewrite architecture.

## Evidence

Every finding needs a measurement or a code citation: query count, response time, payload size, bundle stat, or execution plan, plus the file or endpoint. Label unmeasured impact as a hypothesis. Do not report a bottleneck from a general impression.

Inspect React render cost, Vite production bundle size, Django query count and serializers, SQL Server plans and indexes, API payload and pagination, and Django SQL Server connection settings. Read execution plans and configuration. Do not execute migrations or write queries that modify data.

Recommend `select_related`, `prefetch_related`, `only`, `defer`, caching, or memoization only when the measured query or render shows they apply.

## Report

1. Executive summary.
2. Finding, severity (Critical, High, Medium, Low), files, and endpoints.
3. Evidence (metric, method, result).
4. Hypothesis for the cause, separate from the measurement.
5. Recommended performance change and regression risk, including auth, RBAC, and migrations.
6. Active Django settings module and database target identified before any database observation.

## Implementation

Start only after the user approves specific findings.

- Confirm a SQL Server `.bak` backup before any schema-changing operation.
- Verify the active Django settings module and database target. Use an isolated test database for automated tests.
- Record a baseline first, using the same endpoint, dataset, and environment.
- Change one approved finding at a time. Preserve business logic.
- Re-run that same measurement. Report both numbers and the method.
- Run the production frontend build, backend tests against the isolated test database, Django system checks, and the existing auth and RBAC tests.
- If the baseline was not recorded, say what was verified and do not claim a performance improvement.
