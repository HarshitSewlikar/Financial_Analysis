# MySQL 8 to SQL Server 2025 Migration Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This repository contains a `.git` directory; do not initialize git or create commits; take filesystem snapshots instead.

**Goal:** Move the Financial Analysis Django backend from MySQL 8 to SQL Server 2025 without losing users, password hashes, RBAC state, audit history, menus, to-dos, primary keys, or application behavior.

**Architecture:** Run the existing Django migrations unchanged against a new SQL Server database, copy application rows with a standalone source-read-only ETL tool, preserve identity values and foreign keys, then rewrite the MySQL operator layer as SQL Server views and stored procedures. The Django ORM remains the runtime authorization path; the SQL operator layer must match `access_control/policy.py`.

**Tech Stack:** Django 5.2.18, Django REST Framework 3.17.2, `mssql-django==2.0.0`, `pyodbc==5.3.0`, Microsoft ODBC Driver 18 for SQL Server, SQL Server 2025 Standard Developer Edition, Python 3.14, pytest 9.1.1, `sqlcmd`.

**Spec:** This document is the authoritative migration handoff. It supersedes earlier MySQL-specific assumptions in `docs/MIGRATION.md` and `PLAN.md`.

---

## Global Constraints

- Target database: SQL Server 2025 Standard Developer Edition, local default instance `MSSQLSERVER`, Windows Integrated Authentication, TCP/IP disabled for now; use the local shared-memory path until TCP is explicitly approved.
- Database collation: `Latin1_General_100_CI_AI_SC_UTF8` for both `financial_dashboard` and `test_financial_dashboard`.
- Django settings: `USE_TZ=True`, `TIME_ZONE="UTC"`. With `USE_TZ=True`, `mssql-django` maps `DateTimeField` to `datetimeoffset`; all copied timestamps must be UTC with `+00:00`.
- Source MySQL timestamps are assumed to be UTC. Do not apply a local-time conversion.
- Preserve every application primary key. Do not let SQL Server generate new IDs during the initial copy.
- Preserve password hashes exactly. Never rehash, reset, or log passwords/hashes.
- The ETL tool must never write to MySQL. It opens the source connection read-only in practice and issues only `SELECT`/session statements.
- Stop the Django backend and all frontend writes before the final MySQL snapshot. The source database must not change during the copy.
- Do not copy `django_migrations`, `django_session`, `django_content_type`, `django_admin_log`, `auth_*`, or `rest_framework_simplejwt_blacklist*`. Users must log in again after cutover.
- Django auth groups and `auth_permission` rows are not required. Application authorization is `access_control`, not Django groups.
- Copy only these application tables:
  `accounts_user`, `accounts_setupstate`, `accounts_loginattempt`,
  `access_control_role`, `access_control_permission`,
  `access_control_rolepermission`, `access_control_userrole`,
  `access_control_userpermissionoverride`,
  `navigation_menu`, `navigation_rolemenu`,
  `todos_todo`, `audit_auditlog`.
- Keep the existing Django migrations; they are backend-agnostic. Do not regenerate migrations.
- Runtime SQL login: `finapp` (`db_datareader`, `db_datawriter`). Migration/test login: `finapp_migrator` (`db_owner` on the app and test DBs). Operator login: `finapp_operator` (views and procedures only).
- Local ODBC connection string: `Encrypt=yes;TrustServerCertificate=yes`. Production must use a valid certificate and `TrustServerCertificate=no`.
- Pre-create `test_financial_dashboard`; run tests with `pytest --reuse-db` and the `finapp_migrator` login.
- Use a separate `.venv-sqlserver`; preserve the existing `.venv` as a rollback artifact.
- No frontend code changes are required. The frontend talks only to the Django API.
- Do not delete the MySQL database or its dump for at least 7 days after cutover.
- Do not print, commit, or paste real `.env` values into logs or documentation.

## Review Focus

The implementation must explicitly test these failure modes:

1. **Time zone shift:** MySQL `DATETIME(6)` values are naive UTC; SQL Server `datetimeoffset` values must round-trip with offset `+00:00`, and `timezone.now()` must not shift on a non-UTC SQL Server host.
2. **Nullable unique email:** `User.email` is `null=True, blank=True, unique=True`; multiple `NULL`s must be allowed while duplicate non-null emails are rejected. Verify SQL Server has a filtered unique index.
3. **Operator authorization drift:** `v_user_access` and the operator procedures must exactly preserve `policy.py` precedence: inactive/deleted, protected admin, DENY, ALLOW, role, none; unregistered codes are inert; the final administrator cannot be removed.
4. **Identity and foreign-key corruption:** All copied IDs must equal source IDs; identity seeds must be greater than the maximum copied ID; every foreign key must resolve; no child row may point at a missing parent.
5. **Unicode and JSON corruption:** UTF-8 text, supplementary characters, audit JSON objects, and password hash prefixes must survive normalization, hashing, and round-trip reads unchanged.

---

## Assumptions Confirmed by the User

- Source timestamps are UTC.
- Django groups and Django auth permissions do not need to be preserved.
- The dataset is under approximately 1 GB / 1 million rows, so a Python row-copy tool with batched inserts is acceptable.
- `Latin1_General_100_CI_AI_SC_UTF8` is acceptable for case-insensitive and accent-insensitive behavior matching MySQL `utf8mb4_unicode_ci`.
- A hard cutover with a maintenance window is acceptable; dual-writing is not required.

---

## File Structure

### Create

- `backend-django/sql/provision_sqlserver.sql` — creates databases, logins, users, roles, and grants. Uses SQLCMD variables; contains no real passwords.
- `backend-django/sql/verify_schema.sql` — read-only schema checks: collation, tables, column types, filtered indexes, identity columns.
- `backend-django/sql/operator_access.sql` — new SQL Server T-SQL operator layer.
- `backend-django/sql/operator_access.mysql.sql` — preserved copy of the current MySQL operator layer for rollback/reference.
- `backend-django/tools/__init__.py` — package marker.
- `backend-django/tools/mysql_to_mssql.py` — standalone ETL and verification CLI.
- `backend-django/apps/access_control/operator_verify.py` — Python-side expected-access model and comparison helpers.
- `backend-django/apps/access_control/management/commands/verify_operator_access.py` — management command that compares the SQL views/procedures against `policy.py`.
- `backend-django/tests/test_sqlserver_settings.py` — settings and driver assertions.
- `backend-django/tests/test_mssql_compat.py` — ORM/schema compatibility tests on SQL Server.
- `backend-django/tests/test_mysql_to_mssql.py` — ETL normalization, ordering, and verification tests.
- `backend-django/tests/test_operator_sql.py` — T-SQL operator-layer behavior and parity tests.
- `docs/SQL_SERVER_MIGRATION.md` — operator runbook, cutover, rollback, and validation.
- `docs/MYSQL_TO_SQLSERVER_MIGRATION_PLAN.md` — this plan.

### Modify

- `backend-django/requirements.txt` — replace `mysqlclient` with `mssql-django` and `pyodbc`.
- `backend-django/requirements-migration.txt` — new source-only ETL requirements file.
- `backend-django/.env.example` — separate source MySQL variables from target SQL Server variables.
- `backend-django/config/settings.py` — replace the MySQL database block with `mssql`.
- `backend-django/apps/access_control/catalog.py` — update the stale MySQL docstring to “database” or “SQL Server”.
- `backend-django/apps/access_control/policy.py` — update the stale “resolved from MySQL” docstring.
- `backend-django/apps/accounts/management/commands/import_legacy_users.py` — update the stale “into MySQL” docstring.
- `backend-django/tests/conftest.py` — make `bootstrap_ready` recreate the `SetupState` singleton if a transaction test flushed it.
- `backend-django/README.md` — SQL Server setup, env, migration, and test commands.
- `README.md` — replace MySQL prerequisites with SQL Server prerequisites.
- `docs/MIGRATION.md` — update the “Current storage” row and cross-reference the SQL Server runbook.

### Do Not Modify

- Existing Django migrations under `apps/*/migrations/`.
- Frontend files under `financial-dashboard-frontend/`.
- Market-data logic, scoring, or chart code.
- The legacy `backend/` service and `backend/data/users.json`.

---

## Task 1: Baseline Snapshot and SQL Server Provisioning

**Files:**
- Create: `backend-django/sql/provision_sqlserver.sql`
- Create: `backend-django/sql/verify_schema.sql`
- Create: `backups/<timestamp>/` (untracked snapshot directory)
- Modify: none

**Interfaces:**
- Produces: databases `financial_dashboard`, `test_financial_dashboard` with collation `Latin1_General_100_CI_AI_SC_UTF8`; SQL logins `finapp`, `finapp_migrator`, `finapp_operator`; a verified MySQL dump and code snapshot.

- [ ] **Step 1: Stop writers and record the maintenance start**

Stop the Django server and any frontend/backend process that can write to MySQL. Record the start time in the runbook. Do not restart the backend until Task 8.

- [x] **Step 2: Take a full MySQL dump**

Use the dedicated `finapp_backup` account. It must have `SELECT` on
`financial_dashboard.*` only. Do not use `root` and do not grant global privileges.
The full logical backup covers **all 24 source tables**; the ETL migration remains
limited to the existing 12 application tables. These are separate scopes.

Source characteristics recorded during inspection:

- All 24 base tables use InnoDB.
- GTID mode is `OFF`.
- Binary logging is `ON`.
- No views, routines, events, or triggers currently exist.

Use the matching MySQL 8.0.42 client:
`C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqldump.exe`.

```powershell
$ErrorActionPreference = "Stop"
cd C:\Users\LENOVO\Desktop\data_analysis\Financial_Analysis
$ts = Get-Date -Format "yyyyMMdd-HHmmss-fff"
$backupDir = "backups\$ts"
$backupFile = Join-Path $backupDir "financial_dashboard_mysql8.sql"
$mysqldump = "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqldump.exe"

if (-not (Test-Path -LiteralPath $mysqldump -PathType Leaf)) {
    throw "mysqldump.exe not found: $mysqldump"
}
if (Test-Path -LiteralPath $backupDir) {
    throw "Refusing to overwrite existing backup directory: $backupDir"
}
if (Test-Path -LiteralPath $backupFile) {
    throw "Refusing to overwrite existing backup file: $backupFile"
}

New-Item -ItemType Directory -Path $backupDir -ErrorAction Stop | Out-Null

& $mysqldump `
  --user=finapp_backup --password `
  --host=127.0.0.1 --port=3306 `
  --single-transaction --skip-lock-tables --no-tablespaces `
  --set-gtid-purged=OFF --skip-triggers `
  --databases financial_dashboard `
  --result-file="$backupFile"
$dumpExitCode = $LASTEXITCODE

if ($dumpExitCode -ne 0) {
    throw "mysqldump failed with exit code $dumpExitCode. Treat the backup as failed."
}
if (-not (Test-Path -LiteralPath $backupFile -PathType Leaf)) {
    throw "Backup file was not created: $backupFile"
}
$backupItem = Get-Item -LiteralPath $backupFile
if ($backupItem.Length -le 0) {
    throw "Backup file is empty: $backupFile"
}
$hash = Get-FileHash -LiteralPath $backupFile -Algorithm SHA256
Write-Output ("BACKUP_FILE=" + $backupItem.FullName)
Write-Output ("BACKUP_BYTES=" + $backupItem.Length)
Write-Output ("SHA256=" + $hash.Hash)
```

`--password` prompts for the `finapp_backup` password; no password is written to the
command, documentation, or shell history. The command writes through `--result-file`;
never use PowerShell `>` redirection.

The script refuses to reuse an existing timestamped directory or backup file. It also
stops on a missing `mysqldump.exe`, a nonzero exit code, a missing output file, or an
empty output file.

Do not add `--routines`, `--events`, `--source-data`/`--master-data`, or `--flush-logs`.
With no views, routines, events, or triggers, the account needs no `SHOW VIEW`,
`TRIGGER`, `EVENT`, `PROCESS`, `RELOAD`, or `FLUSH_TABLES` privileges. The options above
avoid those requirements.

- [x] Full MySQL dump completed and audited.
- [x] Isolated restore verification completed.

Verified backup:

- File: `backups/20261101-131206-233/financial_dashboard_mysql8.sql`
- Size: `61,339` bytes
- SHA256: `6D1B110CC2406BAC1ADA8A3CDB5B69034F3D3E20BD4BB4C9196C349FF5D5D1BE`
- Contents: 24 `CREATE TABLE` definitions
- Storage engine: all 24 tables InnoDB

Restore verification passed against a disposable MySQL 8.0.42 instance:

- Port: `3307`
- Restore exit code: `0`
- Tables restored: all 24 expected tables present
- Storage engine: 24/24 InnoDB
- `mysqlcheck`: 24/24 OK
- `accounts_user`: 2 rows
- `accounts_setupstate` `id=1`: 1 row
- `todos_todo`: 0 rows
- SHA256 before and after restoration: identical
- Temporary MySQL instance: shut down successfully
- Temporary directory: removed successfully

Verification scope:

- Original production `MySQL80` service remained running.
- No production database changes occurred.
- No Django migrations or SQL Server ETL occurred.

- [ ] **Step 3: Snapshot the code and environment**

The repository has no git history. Use a filesystem snapshot:

```powershell
robocopy backend-django "backups\$ts\backend-django" /E /XD .venv .venv-sqlserver __pycache__ logs
robocopy financial-dashboard-frontend "backups\$ts\financial-dashboard-frontend" /E /XD node_modules dist .vite
Copy-Item backend-django\.env "backups\$ts\.env.backup"
```

`robocopy` exit codes 0–7 are success. Preserve the entire timestamped directory.

- [ ] **Step 4: Record current versions**

```powershell
python --version
mysql --version
Get-OdbcDriver | Format-Table Name, Platform
sqlcmd -?
```

Expected: record the current Python, MySQL, ODBC, and `sqlcmd` versions in the runbook. Do not install anything yet.

- [ ] **Step 5: Verify SQL Server 2025 Standard Developer Edition, ODBC Driver 18, and sqlcmd**

Do not install or uninstall SQL Server. The approved local target is SQL Server 2025 Standard Developer Edition, default instance `MSSQLSERVER`, with Windows Integrated Authentication and TCP/IP disabled for now. Use the local shared-memory connection path; do not enable TCP, SQL Browser, remote connectivity, or mixed-mode authentication without approval. Confirm:

```powershell
sqlcmd -S . -E -C -Q "SELECT @@VERSION"
Get-OdbcDriver | Where-Object Name -like "*ODBC Driver 18*"
sqlcmd -?
```

Expected: SQL Server 2025 Standard Developer Edition, ODBC Driver 18 for SQL Server, and a working `sqlcmd`. The `-C` flag is only for local certificate trust during inspection; it is not a permanent server setting.

- [ ] **Step 6: Write `provision_sqlserver.sql`**

The script must be idempotent, must not hardcode real passwords, and must use SQLCMD variables. It creates:

```sql
-- Pass AppPassword, MigratorPassword, and OperatorPassword with sqlcmd -v.
:setvar DbName "financial_dashboard"
:setvar TestDbName "test_financial_dashboard"
:setvar AppLogin "finapp"
:setvar MigratorLogin "finapp_migrator"
:setvar OperatorLogin "finapp_operator"

IF DB_ID(N'$(DbName)') IS NULL
    CREATE DATABASE [$(DbName)] COLLATE Latin1_General_100_CI_AI_SC_UTF8;
IF DB_ID(N'$(TestDbName)') IS NULL
    CREATE DATABASE [$(TestDbName)] COLLATE Latin1_General_100_CI_AI_SC_UTF8;
```

Generate long URL-safe alphanumeric passwords for the three logins. Create each login with `CREATE LOGIN` inside dynamic SQL if it does not exist, then create the database users and grants:

- `finapp`: `db_datareader`, `db_datawriter`.
- `finapp_migrator`: `db_owner` on both databases.
- `finapp_operator`: `CONNECT` now. The view `SELECT` grants and `EXECUTE` on the four public procedures are added after the operator objects are created in Task 6; the internal helper is not granted directly.

- [ ] **Step 7: Run provisioning and verify collation**

```powershell
sqlcmd -S 127.0.0.1 -E -b -i backend-django\sql\provision_sqlserver.sql `
  -v AppPassword="<generated>" MigratorPassword="<generated>" OperatorPassword="<generated>"

sqlcmd -S 127.0.0.1 -E -Q `
  "SELECT name, collation_name FROM sys.databases WHERE name IN ('financial_dashboard','test_financial_dashboard')"
```

Expected: both databases have `Latin1_General_100_CI_AI_SC_UTF8`.

- [ ] **Step 8: Verify logins**

```powershell
sqlcmd -S 127.0.0.1 -U finapp_migrator -P "<migrator-password>" -d financial_dashboard -Q "SELECT DB_NAME(), DATABASEPROPERTYEX(DB_NAME(),'Collation')"
sqlcmd -S 127.0.0.1 -U finapp -P "<app-password>" -d financial_dashboard -Q "SELECT DB_NAME()"
```

Expected: both connect; the app login cannot run DDL.

- [ ] **Step 9: Write schema verification SQL**

`verify_schema.sql` must be read-only and print:

- `DB_NAME()` and `DATABASEPROPERTYEX(DB_NAME(), 'Collation')`.
- All user tables from `INFORMATION_SCHEMA.TABLES`.
- All `DateTimeField` columns and their `datetimeoffset` types.
- All `BooleanField` columns and their `bit` types.
- The filtered unique index on `accounts_user.email`.
- Identity columns and their seed values.

- [ ] **Step 10: Task 1 acceptance**

- Dump and code snapshot exist and are non-empty.
- Both databases exist with the exact collation.
- All three logins connect; `finapp` cannot run DDL; `finapp_operator` has `CONNECT` and will receive view/procedure grants in Task 6.
- MySQL is still running and unchanged.
- Stop here if any check fails.

---

## Task 2: Dependencies, Environment, and Django Settings

**Files:**
- Create: `backend-django/requirements-sqlserver.txt`
- Create: `backend-django/config/settings_sqlserver.py`
- Create: `backend-django/tests_sqlserver/test_settings_sqlserver.py`
- Modify: `backend-django/.env.example`
- Do not modify: `backend-django/requirements.txt`, `backend-django/config/settings.py`, `backend-django/manage.py`, `backend-django/pytest.ini`, `backend-django/.env`
- Future (unchecked): `backend-django/requirements-migration.txt` for the standalone ETL environment

**Interfaces:**
- Produces: `config.settings_sqlserver.DATABASES["default"]["ENGINE"] == "mssql"`; `OPTIONS["python_driver"] == "pyodbc"`; the target collation in both `OPTIONS` and `TEST`; Windows Integrated Authentication without SQL credentials.

- [x] **Step 1: Create and run static SQL Server settings tests**

Implemented five static tests in `tests_sqlserver/test_settings_sqlserver.py` covering the SQL Server engine, Windows Integrated Authentication, absence of `USER`/`PASSWORD`, connection options, test database settings, UTC preservation, and the unchanged MySQL base configuration. The credential-absence test inspects the source with `ast` because Django injects empty `USER`/`PASSWORD` defaults at runtime.

```powershell
.\.venv-sqlserver\Scripts\python.exe -m pytest tests_sqlserver\test_settings_sqlserver.py --ds=config.settings_sqlserver -c pytest.ini -v
```

Verified: `5 passed`.

- [x] **Step 2: Create `requirements-sqlserver.txt`**

```text
Django==5.2.18
djangorestframework==3.17.2
djangorestframework-simplejwt==5.5.1
django-cors-headers==4.9.0
django-filter==25.2
argon2-cffi==25.1.0
bcrypt==5.0.0
python-dotenv==1.2.4
requests==2.34.2
mssql-django==2.0.0
mssql-python==1.16.0
pyodbc==5.3.0
pytest==9.1.1
pytest-django==4.14.0
gunicorn==23.0.0; sys_platform != "win32"
```

Installed with `--only-binary=:all:`; all required wheels were available and no source builds were used. `pip check` passed with no broken requirements. Python is `3.13.17` x64; pip is `26.2.2`.

Exact installed package versions:

```text
argon2-cffi==25.1.0
argon2-cffi-bindings==26.1.0
asgiref==3.13.0
azure-core==1.41.0
azure-identity==1.27.0
bcrypt==5.0.0
certifi==2026.10.23
cffi==2.1.1
charset-normalizer==3.5.2
colorama==0.4.6
cryptography==50.0.2
Django==5.2.18
django-cors-headers==4.9.0
django-filter==25.2
djangorestframework==3.17.2
djangorestframework-simplejwt==5.5.1
idna==3.20
iniconfig==2.3.1
msal==1.39.0
msal-extensions==1.3.1
mssql-django==2.0.0
mssql-python==1.16.0
mssql-python-odbc==18.6.2.2
mssql-python-rs==0.3.0
packaging==26.3
pip==26.2.2
pluggy==1.7.0
pycparser==3.12
Pygments==2.21.0
PyJWT==2.15.1
pyodbc==5.3.0
pytest==9.1.1
pytest-django==4.14.0
python-dotenv==1.2.4
requests==2.34.2
sqlparse==0.6.0
typing_extensions==4.16.0
tzdata==2026.6
urllib3==2.8.0
```

`mssql-django` 2.0 installs both `pyodbc` and `mssql-python`; `python_driver="pyodbc"` explicitly selects the default pyodbc path. `gunicorn` is skipped on Windows by its platform marker. `mysqlclient` is not installed in this environment.

- [ ] **Step 3: Create `requirements-migration.txt`**

Deferred to the standalone ETL stage. This file is only for the source-side ETL and must not be added to the SQL Server runtime environment.

- [x] **Step 4: Update `.env.example`**

Appended only the SQL Server target block:

```dotenv
# SQL Server target (Windows Integrated Authentication)
MSSQL_DB_NAME=financial_dashboard
MSSQL_TEST_DB_NAME=test_financial_dashboard
MSSQL_HOST=.
MSSQL_PORT=
MSSQL_DRIVER=ODBC Driver 18 for SQL Server
MSSQL_COLLATION=Latin1_General_100_CI_AI_SC_UTF8
MSSQL_ENCRYPT=yes
MSSQL_TRUST_SERVER_CERTIFICATE=yes
MSSQL_TRUSTED_CONNECTION=yes
MSSQL_CONN_MAX_AGE=0
```

Verified: the real `.env` was not modified and no `MSSQL_USER` or `MSSQL_PASSWORD` variables were added.

- [x] **Step 5: Create the separate SQL Server settings module**

Created `config/settings_sqlserver.py`; `config/settings.py` remains the unchanged MySQL configuration.

```python
from .settings import *
from .settings import env


DATABASES = {
    "default": {
        "ENGINE": "mssql",
        "NAME": env("MSSQL_DB_NAME", "financial_dashboard"),
        "HOST": env("MSSQL_HOST", "."),
        "PORT": env("MSSQL_PORT", ""),
        "Trusted_Connection": env("MSSQL_TRUSTED_CONNECTION", "yes"),
        "OPTIONS": {
            "driver": env("MSSQL_DRIVER", "ODBC Driver 18 for SQL Server"),
            "python_driver": "pyodbc",
            "collation": env(
                "MSSQL_COLLATION", "Latin1_General_100_CI_AI_SC_UTF8"
            ),
            "extra_params": (
                f"Encrypt={env('MSSQL_ENCRYPT', 'yes')};"
                "TrustServerCertificate="
                f"{env('MSSQL_TRUST_SERVER_CERTIFICATE', 'yes')};"
            ),
        },
        "TEST": {
            "NAME": env("MSSQL_TEST_DB_NAME", "test_financial_dashboard"),
            "COLLATION": env(
                "MSSQL_COLLATION", "Latin1_General_100_CI_AI_SC_UTF8"
            ),
        },
        "CONN_MAX_AGE": int(env("MSSQL_CONN_MAX_AGE", "0")),
        "CONN_HEALTH_CHECKS": True,
    }
}

DATABASE_CONNECTION_POOLING = True
```

Verified: Windows Integrated Authentication only; no `USER` or `PASSWORD` in the source `DATABASES`; `HOST="."`; `PORT=""`; `Trusted_Connection="yes"`; `Encrypt=yes;TrustServerCertificate=yes;`; `USE_TZ=True` and `TIME_ZONE=UTC` preserved. The original `config/settings.py` and its MySQL engine remain unchanged.

- [x] **Step 6: Create the SQL Server virtual environment**

```powershell
cd backend-django
C:\Users\LENOVO\AppData\Local\Programs\Python\Python313\python.exe -m venv .venv-sqlserver
.\.venv-sqlserver\Scripts\python.exe -m pip install --upgrade pip
.\.venv-sqlserver\Scripts\python.exe -m pip install --only-binary=:all: -r requirements-sqlserver.txt
```

Verified: Python `3.13.17` x64, pip `26.2.2`, `pip check` passed, `pyodbc==5.3.0` imports, and `pyodbc.drivers()` includes `ODBC Driver 18 for SQL Server`. The existing `.venv` remains untouched, `.venv-sqlserver` is Git-ignored, and `mysqlclient` is absent.

- [x] **Step 7: Run settings checks**

```powershell
.\.venv-sqlserver\Scripts\python.exe manage.py check --settings=config.settings_sqlserver
.\.venv-sqlserver\Scripts\python.exe -m pytest tests_sqlserver\test_settings_sqlserver.py --ds=config.settings_sqlserver -c pytest.ini -v
```

Verified: `System check identified no issues (0 silenced).` and `5 passed`. Static inspection confirmed no database connection was opened. No SQL Server or MySQL connection, migration, ORM test, or ETL was performed.

- [x] **Step 8: Task 2 acceptance**

- [x] No `mysqlclient` in the SQL Server runtime environment or `requirements-sqlserver.txt`.
- [x] `ENGINE` is `mssql`; `python_driver` is `pyodbc`; collation values match exactly.
- [x] `USE_TZ=True` and `TIME_ZONE=UTC`.
- [x] The new venv imports `pyodbc` and sees ODBC Driver 18.
- [x] Windows Integrated Authentication is configured with `HOST="."`, `PORT=""`, and `Trusted_Connection="yes"`; no `USER` or `PASSWORD` is configured in the source `DATABASES`.
- [x] Python `3.13.17` x64 and pip `26.2.2` are installed in `.venv-sqlserver`.
- [x] `.venv-sqlserver` imports `pyodbc==5.3.0`; `pip check` reports no broken requirements.
- [x] Five static SQL Server settings tests pass.
- [x] Django system checks report no issues without opening a database connection.
- [x] MySQL configuration is preserved: `config/settings.py` still uses `django.db.backends.mysql`; `requirements.txt` and `.env` hashes match the pre-change values.

Still pending and unchecked: SQL Server runtime identity provisioning, migration identity provisioning, actual database connection testing, Django migrations, ORM testing, and ETL.

---

## Task 3: Apply the Existing Django Schema

**Files:**
- Create: `backend-django/sql/verify_schema.sql` (from Task 1, finalize here)
- Modify: none
- Test: `backend-django/tests/test_mssql_compat.py` (initial schema tests)

**Interfaces:**
- Consumes: the empty SQL Server databases and `finapp_migrator` login.
- Produces: all Django and application tables in `financial_dashboard` and `test_financial_dashboard`; identity seeds; filtered unique email index; `datetimeoffset` timestamp columns.

- [ ] **Step 1: Point the migration environment at `finapp_migrator`**

```powershell
$env:DB_USER = "finapp_migrator"
$env:DB_PASSWORD = "<migrator-password>"
$env:DB_NAME = "financial_dashboard"
$env:DB_HOST = "127.0.0.1"
$env:DB_PORT = "1433"
$env:DB_TEST_NAME = "test_financial_dashboard"
```

Do not edit the real `.env` with the migrator password for normal runtime; use process-scoped environment variables for migrations.

- [ ] **Step 2: Run migrations on the application database**

```powershell
cd backend-django
.\.venv-sqlserver\Scripts\python.exe manage.py migrate --noinput
```

Expected: all migrations apply without errors: `accounts` 0001–0003, `access_control` 0001–0002, `audit` 0001, `navigation` 0001–0002, `todos` 0001, plus Django/Site/SimpleJWT tables.

- [ ] **Step 3: Confirm migration state**

```powershell
.\.venv-sqlserver\Scripts\python.exe manage.py showmigrations
```

Expected: every application migration is marked `[X]`.

- [ ] **Step 4: Verify schema with SQL**

```powershell
sqlcmd -S 127.0.0.1 -U finapp_migrator -P "<migrator-password>" `
  -d financial_dashboard -b -i backend-django\sql\verify_schema.sql
```

Expected:

- `accounts_user`, `accounts_setupstate`, `accounts_loginattempt`,
  `access_control_role`, `access_control_permission`,
  `access_control_rolepermission`, `access_control_userrole`,
  `access_control_userpermissionoverride`,
  `navigation_menu`, `navigation_rolemenu`, `todos_todo`, `audit_auditlog`.
- `DateTimeField` columns are `datetimeoffset`.
- `BooleanField` columns are `bit`.
- `accounts_user.email` has a unique, filtered index whose filter is based on `email IS NOT NULL`.
- `accounts_setupstate.id` is not an identity column; all other model `id` columns are identity.
- `navigation_menu.parent` is a self-referencing FK with `NO_ACTION`; SQL Server cannot use a cascading self-referencing FK.

- [ ] **Step 5: Apply migrations to the test database**

Use pytest’s test database setup:

```powershell
$env:DB_TEST_NAME = "test_financial_dashboard"
.\.venv-sqlserver\Scripts\python.exe -m pytest tests/test_sqlserver_settings.py --reuse-db -v
```

The test database was pre-created in Task 1, and `finapp_migrator` has `db_owner` on it. With `--reuse-db`, Django applies any pending migrations to the existing test database without dropping it. Do not use `--create-db`: dropping/creating a database requires a server-level permission that `finapp_migrator` intentionally does not have. If the test schema is missing and `--reuse-db` does not apply it, run migrations explicitly against `test_financial_dashboard` using the migrator login, then rerun pytest with `--reuse-db`.

Expected: the test database is migrated and reusable.

- [ ] **Step 6: Task 3 acceptance**

- All migrations apply on SQL Server.
- The schema includes all 12 application tables.
- Timestamps are `datetimeoffset`; booleans are `bit`.
- The filtered unique email index exists.
- The `navigation_menu` self-FK is `NO_ACTION`, not `CASCADE`.
- No new migrations were generated.

---

## Task 4: SQL Server ORM Compatibility Tests and Fixes

**Files:**
- Create: `backend-django/tests/test_mssql_compat.py`
- Modify: `backend-django/tests/conftest.py`
- Modify: application code only if a test exposes a real incompatibility
- Test: `backend-django/tests/test_mssql_compat.py`

**Interfaces:**
- Consumes: the migrated test database.
- Produces: proof that datetime, JSON, nullable unique email, RBAC, and locking paths work on SQL Server.

- [ ] **Step 1: Write the compatibility tests**

Add these tests, using the existing `seeded`, `make_user`, and `admin_user` fixtures:

```python
from __future__ import annotations

from datetime import timedelta

import pytest
from django.db import IntegrityError, connection, transaction
from django.utils import timezone

from accounts.models import SetupState
from audit.models import AuditLog
from navigation.models import Menu


@pytest.mark.django_db
def test_datetime_fields_round_trip_as_utc(make_user):
    before = timezone.now().replace(microsecond=123456)
    user = make_user("tz_user", created_at=before)
    user.refresh_from_db()
    assert user.created_at.utcoffset() == timedelta(0)
    assert abs((user.created_at - before).total_seconds()) < 1


@pytest.mark.django_db
def test_datetime_columns_are_datetimeoffset():
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT DATA_TYPE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'accounts_user' AND COLUMN_NAME = 'created_at'
            """
        )
        assert cursor.fetchone()[0].lower() == "datetimeoffset"


@pytest.mark.django_db
def test_multiple_null_emails_are_allowed(make_user):
    first = make_user("null_email_1")
    second = make_user("null_email_2")
    assert first.email is None
    assert second.email is None


@pytest.mark.django_db
def test_duplicate_non_null_email_is_rejected(make_user):
    make_user("email_owner", email="owner@example.com")
    with pytest.raises(IntegrityError):
        make_user("email_dupe", email="owner@example.com")


@pytest.mark.django_db
def test_email_has_filtered_unique_index():
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT COUNT(*)
            FROM sys.indexes
            WHERE object_id = OBJECT_ID('accounts_user')
              AND is_unique = 1
              AND has_filter = 1
              AND filter_definition LIKE '%email%'
            """
        )
        assert cursor.fetchone()[0] >= 1


@pytest.mark.django_db
def test_json_field_round_trip(seeded, make_user):
    actor = make_user("json_actor")
    log = AuditLog.objects.create(
        actor=actor,
        action="json_test",
        resource_type="Test",
        before={"unicode": "café", "nested": {"n": [1, 2, 3]}},
        after={"ok": True},
    )
    log.refresh_from_db()
    assert log.before == {"unicode": "café", "nested": {"n": [1, 2, 3]}}
    assert log.after == {"ok": True}


@pytest.mark.django_db(transaction=True)
def test_select_for_update_on_singleton(seeded):
    SetupState.objects.get_or_create(pk=1)
    with transaction.atomic():
        state = SetupState.objects.select_for_update().get(pk=1)
        assert state.pk == 1


@pytest.mark.django_db
def test_menu_self_fk_is_no_action():
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT delete_referential_action_desc
            FROM sys.foreign_keys
            WHERE parent_object_id = OBJECT_ID('navigation_menu')
              AND referenced_object_id = OBJECT_ID('navigation_menu')
            """
        )
        rows = cursor.fetchall()
    assert rows
    assert rows[0][0].upper() == "NO_ACTION"


@pytest.mark.django_db
def test_menu_parent_delete_cascades_via_orm():
    parent = Menu.objects.create(
        code="test_parent",
        label="Test Parent",
        path="/test-parent",
        component_key="TestParent",
    )
    child = Menu.objects.create(
        code="test_child",
        label="Test Child",
        path="/test-child",
        component_key="TestChild",
        parent=parent,
    )
    parent.delete()
    assert not Menu.objects.filter(pk__in=(parent.pk, child.pk)).exists()
```

If `test_menu_parent_delete_cascades_via_orm` fails, do not weaken it. SQL Server cannot enforce the self-cascade, so implement explicit descendant deletion in `Menu.delete()` (leaf-first) and keep the test as the behavior contract.

- [ ] **Step 2: Run the compatibility tests**

```powershell
.\.venv-sqlserver\Scripts\python.exe -m pytest tests/test_mssql_compat.py --reuse-db -v
```

Expected: PASS. If a test fails, fix the application or migration rather than weakening the assertion.

- [ ] **Step 3: Harden the bootstrap fixture, then run the existing application tests**

The `transaction=True` locking test and the Task 6 procedure tests flush the test database between tests. That flush deletes the data-migration-seeded `accounts_setupstate` row, which later tests expect. Make the fixture recreate it:

```python
# backend-django/tests/conftest.py
@pytest.fixture
def bootstrap_ready(db, seeded):
    state, _ = SetupState.objects.get_or_create(
        pk=1,
        defaults={"is_bootstrapped": False},
    )
    state.is_bootstrapped = False
    state.save(update_fields=["is_bootstrapped"])
    return state
```

Then run:

```powershell
.\.venv-sqlserver\Scripts\python.exe -m pytest --reuse-db -v
```

Expected: PASS. Investigate any SQL Server-specific failure before proceeding. Do not change business behavior to accommodate the backend.

- [ ] **Step 4: Audit known unsupported ORM paths**

Confirm the application does not use these `mssql-django` limitations:

- `JSONField.contains` or JSON containment lookups.
- `select_for_update(of=(...))`.
- `bulk_create(ignore_conflicts=True)`.
- Database-level cascades relied on outside Django; `navigation_menu` must use the ORM path because its self-FK cannot be `CASCADE`.
- `AlterField` on an `AutoField`.

Current code uses `select_for_update()` without `of`, `bulk_create()` without `ignore_conflicts`, and no JSON containment filter. If a new usage appears, replace it with an explicit supported query.

- [ ] **Step 5: Task 4 acceptance**

- All compatibility tests pass, including the `navigation_menu` self-FK and ORM-cascade tests.
- Full existing test suite passes on SQL Server.
- No MySQL-only ORM feature remains in the runtime path.
- No test was weakened to hide a backend difference.

---

## Task 5: Standalone MySQL-to-SQL-Server ETL

**Files:**
- Create: `backend-django/tools/__init__.py`
- Create: `backend-django/tools/mysql_to_mssql.py`
- Create: `backend-django/tests/test_mysql_to_mssql.py`
- Modify: none
- Test: `backend-django/tests/test_mysql_to_mssql.py`

**Interfaces:**
- Consumes: source MySQL via `MYSQL_*`; target SQL Server via `DB_*`.
- Produces: a CLI with `--dry-run`, `--apply`, `--verify`, `--tables`, `--batch-size`, `--replace`, and `--confirm`.
- Produces: `TableSpec`, `TABLES`, `normalize_value`, `table_order`, `verify_table`, and `main`.

- [ ] **Step 1: Define the table order and copy contract**

Use this dependency order:

```text
accounts_user
accounts_setupstate
accounts_loginattempt
access_control_role
access_control_permission
access_control_rolepermission
access_control_userrole
access_control_userpermissionoverride
navigation_menu
navigation_rolemenu
todos_todo
audit_auditlog
```

Reverse this order for `--replace` deletes. `navigation_menu` has a self-FK; insert rows in parent-before-child order by recursive depth, not by `id` alone.

- [ ] **Step 2: Implement the CLI shell**

```python
def main(argv: list[str] | None = None) -> int:
    ...
```

Required behavior:

- `--dry-run`: connect to both databases, report source/target counts, validate table/column overlap, write nothing.
- `--apply --confirm APPLY`: copy rows. Refuse if any target application table is non-empty, with one exception: `accounts_setupstate` is seeded with `id=1` by migration `accounts.0002_setup_state_singleton`. Treat that singleton row as replaceable: delete it before copying, require the source table to contain exactly one row with `id=1`, and do not use `IDENTITY_INSERT` for it. `--replace --confirm REPLACE` remains the explicit path for any other non-empty target.
- `--verify`: compare counts, min/max IDs, canonical row hashes, duplicate emails, FK orphans, identity current values, and password-hash prefixes.
- `--tables`: comma-separated subset for debugging; still preserve dependency order.
- `--batch-size`: default `1000`.
- Exit `0` only when every requested check passes; otherwise print the failing table/column/reason and exit `1`.
- Never log passwords, full connection strings, password hashes, or audit payloads.

- [ ] **Step 3: Implement source reading**

Use a single MySQL connection with:

```sql
SET SESSION time_zone = '+00:00';
SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ;
START TRANSACTION WITH CONSISTENT SNAPSHOT;
```

Use `MySQLdb`/`mysqlclient` with `charset="utf8mb4"`. Issue only `SELECT` statements against application tables. Close the source connection without committing writes; there are none.

- [ ] **Step 4: Implement target metadata and inserts**

- Read target columns from `INFORMATION_SCHEMA.COLUMNS`; intersect with source columns by name.
- Fail if a target `NOT NULL` column has no source value and no default.
- Use `pyodbc` with `fast_executemany=True`.
- Enable `SET IDENTITY_INSERT dbo.<table> ON` only for tables whose target `id` is an identity column; disable it immediately after the batch.
- `accounts_setupstate.id` is not an identity column. Delete the migration-seeded row before inserting the source singleton; never use `IDENTITY_INSERT` for this table.
- Insert in dependency order. For `navigation_menu`, topologically sort by parent depth.
- After each identity table, run `DBCC CHECKIDENT ('dbo.<table>', RESEED, <max_id>)`. If the table is empty, use `RESEED, 0`.
- Delete in reverse dependency order before a `--replace` copy. For `navigation_menu`, delete child-before-parent by depth; do not rely on one `DELETE FROM navigation_menu`, because SQL Server cannot cascade a self-referencing FK.
- Do not disable foreign keys by default. If a temporary `NOCHECK` is unavoidable, re-enable with `WITH CHECK` and verify every FK before success.

- [ ] **Step 5: Implement canonical value normalization**

`normalize_value(value, *, sql_type=None)` must handle:

- `datetime`/`date`: source naive values get `tzinfo=UTC`; target aware values convert to UTC; serialize as ISO-8601 with `timespec="microseconds"` and `+00:00`.
- `bool`: `1`/`0`.
- `Decimal`: normalized decimal string, preserving scale only when required by equality.
- `bytes`/`bytearray`: lowercase hex.
- `dict`/`list`: `json.dumps(..., ensure_ascii=False, sort_keys=True, separators=(",", ":"))`.
- JSON text: parse and re-dump canonically; reject invalid JSON.
- `None`: `None`.
- Everything else: `str(value)`.

Hash each row as SHA-256 over the canonical JSON array of column values in sorted column-name order. Compare source and target hashes.

- [ ] **Step 6: Write unit tests for normalization and ordering**

Test these cases without a live database:

```python
from datetime import datetime, timezone
from decimal import Decimal

from tools.mysql_to_mssql import normalize_value, table_order


def test_naive_datetime_is_treated_as_utc():
    value = normalize_value(datetime(2026, 1, 2, 3, 4, 5, 123456))
    assert value == "2026-01-02T03:04:05.123456+00:00"


def test_json_is_canonicalized():
    assert normalize_value({"b": 1, "a": "café"}) == '{"a":"café","b":1}'


def test_decimal_is_stable():
    assert normalize_value(Decimal("1.2300")) == "1.23"


def test_children_follow_parents():
    order = table_order()
    assert order.index("accounts_user") < order.index("accounts_setupstate")
    assert order.index("access_control_role") < order.index("access_control_rolepermission")
    assert order.index("access_control_permission") < order.index("access_control_rolepermission")
    assert order.index("navigation_menu") < order.index("navigation_rolemenu")
    assert order.index("accounts_user") < order.index("todos_todo")
    assert order.index("accounts_user") < order.index("audit_auditlog")
```

Add tests that a target count mismatch, a hash mismatch, a duplicate non-null email, and an orphan FK each fail verification with a non-zero exit. Add a test that `--apply` accepts only the migration-seeded `accounts_setupstate` singleton and rejects any other non-empty target table.

- [ ] **Step 7: Run the ETL dry run**

```powershell
$env:MYSQL_HOST = "127.0.0.1"
$env:MYSQL_PORT = "3306"
$env:MYSQL_DB = "financial_dashboard"
$env:MYSQL_USER = "root"
$env:MYSQL_PASSWORD = "<source-password>"

.\.venv-sqlserver\Scripts\python.exe -m tools.mysql_to_mssql --dry-run
```

Expected: source/target table counts, column overlap, and no writes. Target application tables are empty except the migration-seeded `accounts_setupstate` singleton (`id=1`), which the apply path replaces.

- [ ] **Step 8: Apply and verify**

```powershell
.\.venv-sqlserver\Scripts\python.exe -m tools.mysql_to_mssql --apply --confirm APPLY
.\.venv-sqlserver\Scripts\python.exe -m tools.mysql_to_mssql --verify
```

Expected: all 12 tables copied; verification exits `0`; every ID matches; every FK resolves; every identity seed is greater than the maximum ID; every password hash prefix is preserved.

- [ ] **Step 9: Reconcile catalog rows without deleting user data**

Run this with the target `DB_*` environment from Task 3; reset the process-scoped variables if this is a new terminal, otherwise `manage.py` would still point at MySQL.

```powershell
.\.venv-sqlserver\Scripts\python.exe manage.py shell -c `
  "from access_control.seed import seed_rbac; seed_rbac(); print('seed_rbac complete')"
```

`seed_rbac()` is idempotent and only creates/updates registered permissions, system roles, and menus. It does not remove custom roles, overrides, or user assignments.

- [ ] **Step 10: Task 5 acceptance**

- `--dry-run`, `--apply`, and `--verify` behave as specified.
- Target IDs, FK relationships, and password hashes match the source.
- No source MySQL rows were modified.
- `seed_rbac()` completes.
- No ETL secrets appear in logs.

---

## Task 6: Rewrite the Operator SQL Layer for SQL Server

**Files:**
- Move: `backend-django/sql/operator_access.sql` → `backend-django/sql/operator_access.mysql.sql`
- Create: `backend-django/sql/operator_access.sql` (T-SQL)
- Create: `backend-django/apps/access_control/operator_verify.py`
- Create: `backend-django/apps/access_control/management/commands/verify_operator_access.py`
- Create: `backend-django/tests/test_operator_sql.py`
- Modify: `backend-django/apps/access_control/catalog.py`, `policy.py` (docstrings only)
- Test: `backend-django/tests/test_operator_sql.py`

**Interfaces:**
- Produces: `dbo.v_registered_permission`, `dbo.v_user_access`, and procedures `dbo.apply_permission_override`, `dbo.set_user_permission`, `dbo.set_todo_permissions`, `dbo.assign_role`, `dbo.remove_role`.
- Produces: `operator_verify.expected_access_map(user: User) -> dict[str, tuple[bool, str]]`.
- Produces: `operator_verify.actual_access_map(cursor) -> dict[tuple[str, str], tuple[bool, str]]`.
- Produces: `python manage.py verify_operator_access`; exit `0` on exact parity, `1` on mismatch.

- [ ] **Step 1: Preserve the MySQL script**

```powershell
Copy-Item backend-django\sql\operator_access.sql backend-django\sql\operator_access.mysql.sql
```

Do not delete the MySQL version until the rollback window closes.

- [ ] **Step 2: Write the T-SQL views**

`operator_access.sql` must not hardcode `USE financial_dashboard`; install it with `sqlcmd -d <database>`. Use `CREATE OR ALTER VIEW` and `GO` batch separators.

`dbo.v_registered_permission` must list exactly the 22 codes from `catalog.py`:

```text
users.read, users.create, users.update, users.deactivate,
roles.read, roles.manage, roles.assign,
permissions.read, permissions.manage, permissions.assign,
menus.read, menus.manage, menus.assign,
todos.read, todos.create, todos.update, todos.delete, todos.assign, todos.manage,
audit.read, audit.export,
market.read
```

`dbo.v_user_access` must reproduce the current MySQL view:

- Cross join every `accounts_user` row with every registered code.
- `allowed = 0` and `comes_from = 'inactive'` when `is_active = 0` or `deleted_at IS NOT NULL`.
- `allowed = 1` and `comes_from = 'protected administrator'` for an active protected admin; role/override rows are ignored.
- Otherwise use `comes_from = 'deny override'`, `'allow override'`, `'role'`, or `'none'` in that order.
- Role grants require active permission, active role, `role.deleted_at IS NULL`, unexpired `UserRole`, and registered code.
- Overrides require active permission and registered code.
- Compare expiry against `SYSUTCDATETIME() AT TIME ZONE 'UTC'`.
- Return exactly one row per user/code. Use `EXISTS` or `OUTER APPLY` for role and override checks; do not join multiple role rows and emit duplicates.

- [ ] **Step 3: Write the procedures**

Use `CREATE OR ALTER PROCEDURE ... WITH EXECUTE AS OWNER`, `SET XACT_ABORT ON`, `BEGIN TRY`/`BEGIN CATCH`, `THROW`, and explicit transactions.

Required behavior:

- `apply_permission_override`: internal writer; `MERGE` into `access_control_userpermissionoverride`; on insert set `granted_by_id = NULL`, `reason = N'operator sql'`, `created_at`/`updated_at` to UTC `datetimeoffset`; on update preserve `created_at` and refresh `updated_at`.
- `set_user_permission`: validate username length, permission code, `@p_allowed IN (0,1)`, registered code, user existence/activity, protected-admin protection, and active permission row; write override and audit `user_overrides_updated`.
- `set_todo_permissions`: same validation; resolve all six to-do permission IDs; throw if any missing/inactive; write all six overrides atomically and one audit row.
- `assign_role`: validate user, protected admin, role active/not deleted, not already assigned; insert `UserRole`; audit `user_roles_updated`.
- `remove_role`: validate user, protected admin, role not deleted, assignment exists; if role is `administrator`, count active non-deleted holders and throw if `<= 1`; delete and audit.
- Audit rows use `actor_id = NULL`, `correlation_id = N''`, `ip_address = NULL`, `user_agent = N'mssql-operator-script'`, and valid JSON in `before`/`after`.

Use `FOR JSON PATH` (or `JSON_OBJECT` with `JSON_QUERY` around nested JSON) so nested arrays/objects are not double-encoded. `before`/`after` must satisfy the JSON check constraint.

- [ ] **Step 4: Add grants**

After creating objects:

```sql
GRANT SELECT ON dbo.v_registered_permission TO [finapp_operator];
GRANT SELECT ON dbo.v_user_access TO [finapp_operator];
GRANT EXECUTE ON dbo.set_user_permission TO [finapp_operator];
GRANT EXECUTE ON dbo.set_todo_permissions TO [finapp_operator];
GRANT EXECUTE ON dbo.assign_role TO [finapp_operator];
GRANT EXECUTE ON dbo.remove_role TO [finapp_operator];
```

Do not grant direct DML on RBAC/audit tables to `finapp_operator`.

- [ ] **Step 5: Implement `operator_verify.py`**

`expected_access_map(user)` must mirror `policy.py` and return the same `(allowed, comes_from)` pairs as the view. Implement two helpers first:

```python
def active_role_permission_codes(user) -> set[str]:
    ...

def active_override_effects(user) -> dict[str, str]:
    ...
```

Then:

```python
def expected_access_map(user) -> dict[str, tuple[bool, str]]:
    if not user.is_active or user.deleted_at is not None:
        return {code: (False, "inactive") for code in REGISTERED_CODES}
    if user.is_protected_admin:
        return {code: (True, "protected administrator") for code in REGISTERED_CODES}
    role_codes = active_role_permission_codes(user)
    overrides = active_override_effects(user)
    result = {}
    for code in REGISTERED_CODES:
        if overrides.get(code) == "DENY":
            result[code] = (False, "deny override")
        elif overrides.get(code) == "ALLOW":
            result[code] = (True, "allow override")
        elif code in role_codes:
            result[code] = (True, "role")
        else:
            result[code] = (False, "none")
    return result
```

`actual_access_map(cursor)` reads `SELECT username, permission_code, allowed, comes_from FROM dbo.v_user_access`. Normalize usernames to lowercase and allowed to `bool`.

- [ ] **Step 6: Implement the management command**

`verify_operator_access` must:

- Compare the view’s registered-code set to `REGISTERED_CODES` exactly.
- Compare every database user × every registered code.
- Fail if the view returns duplicate `(username, permission_code)` rows.
- Fail on missing rows, extra rows, wrong `allowed`, or wrong `comes_from`.
- Print a concise mismatch list without printing audit payloads or sensitive data.
- Exit `1` on any mismatch; `0` otherwise.

- [ ] **Step 7: Install the operator layer on the app and test databases**

```powershell
sqlcmd -S 127.0.0.1 -U finapp_migrator -P "<migrator-password>" `
  -d financial_dashboard -b -i backend-django\sql\operator_access.sql

sqlcmd -S 127.0.0.1 -U finapp_migrator -P "<migrator-password>" `
  -d test_financial_dashboard -b -i backend-django\sql\operator_access.sql
```

Then, with the target `DB_*` variables set to `finapp_migrator`:

```powershell
.\.venv-sqlserver\Scripts\python.exe manage.py verify_operator_access
```

Expected: `OK: operator access matches policy` and exit `0`.

- [ ] **Step 8: Write operator tests**

Use `pytest.mark.django_db(transaction=True)` because the procedures commit. Test:

- Protected admin: every code allowed with `comes_from = 'protected administrator'`, even with a DENY override.
- Inactive and soft-deleted users: every code denied with `comes_from = 'inactive'`.
- DENY override beats a role grant.
- ALLOW override adds a code not granted by a role.
- Unregistered permission rows are ignored.
- `set_user_permission` rejects unregistered codes, inactive users, missing users, protected admins, and `@p_allowed` outside `{0,1}`.
- `set_todo_permissions` writes exactly six overrides and a valid JSON audit row.
- `assign_role` rejects duplicate, missing, and inactive roles.
- `remove_role` refuses the final active administrator and succeeds for a non-final admin.
- `verify_operator_access` returns `0` after the SQL layer is installed.

Use `cursor.execute("EXEC dbo.set_user_permission @p_username=?, @p_permission_code=?, @p_allowed=?", [...])`. Do not use Django ORM to test the operator procedures.

- [ ] **Step 9: Run operator tests**

```powershell
.\.venv-sqlserver\Scripts\python.exe -m pytest tests/test_operator_sql.py --reuse-db -v
```

Expected: PASS.

- [ ] **Step 10: Task 6 acceptance**

- Old MySQL script preserved as `operator_access.mysql.sql`.
- T-SQL script installs cleanly on both databases.
- View and procedures match `policy.py` for every user/code.
- `verify_operator_access` exits `0`.
- Operator tests pass.
- `finapp_operator` has no direct DML on RBAC/audit tables.

---

## Task 7: Documentation and End-to-End Verification

**Files:**
- Create: `docs/SQL_SERVER_MIGRATION.md`
- Modify: `backend-django/README.md`
- Modify: `README.md`
- Modify: `docs/MIGRATION.md`
- Modify: `backend-django/apps/access_control/catalog.py`
- Modify: `backend-django/apps/access_control/policy.py`
- Modify: `backend-django/apps/accounts/management/commands/import_legacy_users.py`
- Test: full backend suite, operator verification, schema verification, frontend build

**Interfaces:**
- Produces: a runbook another operator can follow without reading this plan.
- Produces: documentation that no longer tells users to configure MySQL for runtime.

- [ ] **Step 1: Write `docs/SQL_SERVER_MIGRATION.md`**

Include:

- Prerequisites: SQL Server 2025 Standard Developer Edition, ODBC Driver 18, `sqlcmd`, Python 3.14.
- Database creation and collation.
- Logins and least-privilege grants.
- `.env` variables for source MySQL and target SQL Server.
- Virtual environment and dependency commands.
- Migration, ETL dry-run/apply/verify, `seed_rbac`, operator install, operator verification.
- Cutover and rollback checklists.
- Known `mssql-django` limitations and the fact that the app does not use them.
- A note that users must log in again because JWT blacklist/session tables are not copied.

- [ ] **Step 2: Update stale MySQL documentation**

- `README.md`: replace “MySQL 8” prerequisites with SQL Server 2025 and ODBC Driver 18.
- `backend-django/README.md`: update setup, `.env`, migrate, test, and operator commands.
- `docs/MIGRATION.md`: change the “Current storage” row to SQL Server 2025 and link to `SQL_SERVER_MIGRATION.md`.
- Update docstrings in `catalog.py`, `policy.py`, and `import_legacy_users.py` so they no longer say “MySQL” where the runtime is now SQL Server.

- [ ] **Step 3: Run the full backend test suite**

```powershell
cd backend-django
.\.venv-sqlserver\Scripts\python.exe -m pytest --reuse-db -v
```

Expected: PASS, including `test_sqlserver_settings.py`, `test_mssql_compat.py`, `test_mysql_to_mssql.py`, and `test_operator_sql.py`.

- [ ] **Step 4: Run schema and operator verification**

```powershell
sqlcmd -S 127.0.0.1 -U finapp_migrator -P "<migrator-password>" `
  -d financial_dashboard -b -i backend-django\sql\verify_schema.sql

.\.venv-sqlserver\Scripts\python.exe manage.py verify_operator_access
```

Expected: schema checks pass; operator access matches policy.

- [ ] **Step 5: Run a local API smoke test**

Start the backend with the runtime login (`finapp`, not `finapp_migrator`):

```powershell
$env:DB_USER = "finapp"
$env:DB_PASSWORD = "<app-password>"
.\.venv-sqlserver\Scripts\python.exe manage.py runserver 127.0.0.1:8000
```

In another terminal:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/v1/health/
```

Then use the frontend or an HTTP client to verify:

- Bootstrap status or existing login works with a preserved password.
- `GET /api/v1/auth/me/access/` returns permissions and menus.
- `GET /api/v1/todos/` returns existing to-dos.
- `GET /api/v1/audit-logs/` returns existing audit rows.
- `GET /api/v1/market/movers/` returns data or deterministic mock data.
- A permission change through the UI is visible after the 30-second refresh.

- [ ] **Step 6: Build the frontend**

```powershell
cd ..\financial-dashboard-frontend
npm ci
npm run build
```

Expected: production build succeeds. No frontend source changes are required.

- [ ] **Step 7: Task 7 acceptance**

- Documentation contains no runtime MySQL instructions.
- Full backend suite passes.
- Operator and schema verifications pass.
- API smoke checks pass with the least-privilege runtime login.
- Frontend builds.

---

## Task 8: Cutover, Monitoring, and Rollback

**Files:**
- Modify: `backend-django/.env` (real local file; never commit)
- Modify: `docs/SQL_SERVER_MIGRATION.md` (record actual timestamps/results)
- No code changes

**Interfaces:**
- Consumes: verified SQL Server database, installed operator layer, passing tests.
- Produces: production cutover with a tested rollback path.

- [ ] **Step 1: Freeze writes**

Stop the frontend and backend. Put up a maintenance page or stop the reverse proxy. Confirm no process can write to MySQL.

- [ ] **Step 2: Take the final MySQL dump**

Repeat Task 1 Step 2 into a new timestamped directory. This is the rollback baseline.

- [ ] **Step 3: Run the final ETL against the frozen source**

```powershell
.\.venv-sqlserver\Scripts\python.exe -m tools.mysql_to_mssql --dry-run
.\.venv-sqlserver\Scripts\python.exe -m tools.mysql_to_mssql --apply --replace --confirm REPLACE
.\.venv-sqlserver\Scripts\python.exe -m tools.mysql_to_mssql --verify
```

Use `--replace --confirm REPLACE` for the final cutover because the rehearsal in Task 5 may already have populated the target application tables. `--replace` deletes and recopies only the 12 listed application tables; it never touches MySQL.

Expected: dry-run counts match source; replace/apply succeeds; verify exits `0`.

- [ ] **Step 4: Reconcile and install the operator layer**

```powershell
$env:DB_NAME = "financial_dashboard"
$env:DB_USER = "finapp_migrator"
$env:DB_PASSWORD = "<migrator-password>"
$env:DB_HOST = "127.0.0.1"
$env:DB_PORT = "1433"

.\.venv-sqlserver\Scripts\python.exe manage.py shell -c `
  "from access_control.seed import seed_rbac; seed_rbac()"
sqlcmd -S 127.0.0.1 -U finapp_migrator -P "<migrator-password>" `
  -d financial_dashboard -b -i backend-django\sql\operator_access.sql
.\.venv-sqlserver\Scripts\python.exe manage.py verify_operator_access
```

Expected: `seed_rbac` completes; operator install succeeds; verification exits `0`.

- [ ] **Step 5: Switch the runtime `.env`**

Set only the target SQL Server values for the running app:

```dotenv
DB_NAME=financial_dashboard
DB_USER=finapp
DB_PASSWORD=<app-password>
DB_HOST=127.0.0.1
DB_PORT=1433
DB_TEST_NAME=test_financial_dashboard
DB_ODBC_DRIVER=ODBC Driver 18 for SQL Server
DB_ENCRYPT=yes
DB_TRUST_SERVER_CERTIFICATE=yes
DB_CONN_MAX_AGE=60
```

Keep `MYSQL_*` values only for the ETL/rollback window. Do not give `finapp` DDL rights. Clear any process-scoped migration variables before starting the app, because `load_dotenv` does not override existing environment variables:

```powershell
Remove-Item Env:DB_USER, Env:DB_PASSWORD, Env:DB_NAME, Env:DB_HOST, Env:DB_PORT -ErrorAction SilentlyContinue
```

Open a fresh terminal if you are unsure which environment variables are still set.

- [ ] **Step 6: Start and smoke test**

Start the backend, then the frontend. Run the Task 7 smoke checks. Confirm:

- Existing users can log in with their old passwords.
- RBAC permissions and menus match the old system.
- To-dos and audit history are present.
- Operator views/procedures work.
- No `mysqlclient`/MySQL connection appears in logs.

- [ ] **Step 7: Monitor**

For at least 24 hours, watch:

- `django.security` logs.
- Login failures and lockouts.
- SQL Server errors/deadlocks.
- Audit log growth.
- Any `datetimeoffset`-related errors.

- [ ] **Step 8: Rollback procedure**

If a blocking defect appears:

1. Stop the backend and frontend.
2. Restore the previous `backend-django/.env` from `backups/<timestamp>/.env.backup`.
3. Restore the code snapshot if needed.
4. Start the MySQL-backed backend using the preserved `.venv`.
5. Verify login, RBAC, to-dos, audit, and market endpoints.
6. Do not delete the SQL Server database or MySQL dump; preserve both for diagnosis.

MySQL was read-only during the ETL, so a MySQL rollback should not need a data restore. If anything wrote to MySQL during the cutover, restore the final dump before restarting.

- [ ] **Step 9: Decommission after the rollback window**

Only after 7 days of successful SQL Server operation:

- Archive the final MySQL dump and snapshots.
- Revoke/disable the source MySQL application login.
- Keep the legacy `backend/` and `backend/data/users.json` untouched.
- Remove `MYSQL_*` from the runtime `.env` only after the ETL is no longer needed.

- [ ] **Step 10: Task 8 acceptance**

- Cutover checklist completed and timestamped.
- Runtime uses `finapp` only.
- Smoke tests pass.
- Rollback path is documented and still available.
- No data loss or ID changes.

---

## Definition of Done

- [ ] SQL Server 2025 databases exist with `Latin1_General_100_CI_AI_SC_UTF8`.
- [ ] `requirements.txt` uses `mssql-django==2.0.0` and `pyodbc==5.3.0`; no runtime `mysqlclient`.
- [ ] `settings.py` uses `mssql`, `python_driver=pyodbc`, `USE_TZ=True`, `TIME_ZONE=UTC`.
- [ ] Existing migrations apply without modification.
- [ ] All 12 application tables are copied with identical IDs and valid FKs.
- [ ] Password hashes are byte-for-byte preserved.
- [ ] Timestamps are UTC `datetimeoffset` values.
- [ ] Nullable unique email uses a filtered unique index.
- [ ] Audit JSON round-trips and satisfies the JSON constraint.
- [ ] `v_user_access` and all five procedures match `policy.py`.
- [ ] `python manage.py verify_operator_access` exits `0`.
- [ ] Full backend test suite passes on SQL Server with `--reuse-db`.
- [ ] Frontend builds and API smoke tests pass.
- [x] MySQL dump exists and passed isolated restore verification.
- [ ] Code snapshot and rollback instructions are preserved.
- [ ] No frontend source changes are required.

---

## Appendix A: Target `settings.py` Database Block

```python
DATABASES = {
    "default": {
        "ENGINE": "mssql",
        "NAME": env("DB_NAME", "financial_dashboard"),
        "USER": env("DB_USER", "finapp"),
        "PASSWORD": env("DB_PASSWORD", ""),
        "HOST": env("DB_HOST", "127.0.0.1"),
        "PORT": env("DB_PORT", "1433"),
        "Trusted_Connection": "no",
        "OPTIONS": {
            "driver": env("DB_ODBC_DRIVER", "ODBC Driver 18 for SQL Server"),
            "python_driver": "pyodbc",
            "collation": "Latin1_General_100_CI_AI_SC_UTF8",
            "extra_params": (
                f"Encrypt={env('DB_ENCRYPT', 'yes')};"
                f"TrustServerCertificate={env('DB_TRUST_SERVER_CERTIFICATE', 'yes')}"
            ),
        },
        "TEST": {
            "NAME": env("DB_TEST_NAME", "test_financial_dashboard"),
            "COLLATION": "Latin1_General_100_CI_AI_SC_UTF8",
        },
        "CONN_MAX_AGE": int(env("DB_CONN_MAX_AGE", "60")),
        "CONN_HEALTH_CHECKS": True,
    }
}

DATABASE_CONNECTION_POOLING = True
```

`mssql-django` 2.0 uses `datetimeoffset` for `DateTimeField` when `USE_TZ=True`. Do not change `USE_TZ` to make the copy easier.

## Appendix B: Exact Table Copy Order

```text
1. accounts_user
2. accounts_setupstate
3. accounts_loginattempt
4. access_control_role
5. access_control_permission
6. access_control_rolepermission
7. access_control_userrole
8. access_control_userpermissionoverride
9. navigation_menu
10. navigation_rolemenu
11. todos_todo
12. audit_auditlog
```

`navigation_menu` self-FK rows must be inserted parent-before-child by depth and deleted child-before-parent by depth. SQL Server cannot enforce a self-referencing cascade, so the FK is `NO_ACTION` and Django must perform the cascade. `accounts_setupstate.id` is not an identity column; do not use `IDENTITY_INSERT` for it.

## Appendix C: Excluded Tables

Do not copy:

- `django_migrations`
- `django_session`
- `django_content_type`
- `django_admin_log`
- `auth_group`, `auth_permission`, `auth_group_permissions`
- `accounts_user_groups`, `accounts_user_user_permissions`
- `rest_framework_simplejwt_blacklist*`

Users must re-authenticate after cutover. Application roles and permissions are in `access_control_*`, not Django auth tables.

## Appendix D: Operator SQL Parity Checklist

| Case | `allowed` | `comes_from` |
| --- | --- | --- |
| User inactive or soft-deleted | `0` | `inactive` |
| Active protected admin | `1` | `protected administrator` |
| DENY override, active user | `0` | `deny override` |
| ALLOW override, active user | `1` | `allow override` |
| Active role grant, no override | `1` | `role` |
| No grant, no override | `0` | `none` |
| Permission code not in catalog | excluded from view | excluded from view |
| Inactive permission row | excluded | excluded |
| Inactive/deleted role | excluded | excluded |
| Expired user-role | excluded | excluded |

The view tests DENY before ALLOW even though the unique constraint should prevent both.

## Appendix E: Verification Commands

```powershell
# Settings and schema
.\.venv-sqlserver\Scripts\python.exe -m pytest tests/test_sqlserver_settings.py --reuse-db -v
sqlcmd -S 127.0.0.1 -U finapp_migrator -P "<migrator-password>" -d financial_dashboard -b -i backend-django\sql\verify_schema.sql

# Full suite
.\.venv-sqlserver\Scripts\python.exe -m pytest --reuse-db -v

# ETL (first empty-target copy)
.\.venv-sqlserver\Scripts\python.exe -m tools.mysql_to_mssql --dry-run
.\.venv-sqlserver\Scripts\python.exe -m tools.mysql_to_mssql --apply --confirm APPLY
.\.venv-sqlserver\Scripts\python.exe -m tools.mysql_to_mssql --verify

# Final cutover refresh when the target already contains rehearsal data
.\.venv-sqlserver\Scripts\python.exe -m tools.mysql_to_mssql --apply --replace --confirm REPLACE
.\.venv-sqlserver\Scripts\python.exe -m tools.mysql_to_mssql --verify

# Operator layer
sqlcmd -S 127.0.0.1 -U finapp_migrator -P "<migrator-password>" -d financial_dashboard -b -i backend-django\sql\operator_access.sql
.\.venv-sqlserver\Scripts\python.exe manage.py verify_operator_access
```

## Appendix F: Known `mssql-django` Limitations

The current codebase does not use these features, but do not introduce them during the migration:

- `JSONField.contains` and some JSON containment lookups.
- `select_for_update(of=(...))`; plain `select_for_update()` is used and supported.
- `bulk_create(ignore_conflicts=True)`; plain `bulk_create()` is used.
- Database-level cascades that bypass Django, including any `CASCADE` on a self-referencing FK such as `navigation_menu.parent`.
- `AlterField` on `AutoField`.

If a new incompatibility appears, change the application to use a supported query; do not weaken tests or hand-edit generated SQL.
