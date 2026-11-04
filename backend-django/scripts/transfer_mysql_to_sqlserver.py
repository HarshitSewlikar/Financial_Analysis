"""Copy application rows from the isolated MySQL restore into SQL Server.

The default is a dry-run. ``--apply`` is the only mode that writes. All
application-table writes, checks, and identity reseeds run in one SQL Server
transaction. The source is ``finapp_mysql_phase4_src`` through the
``phase4_restore`` login path. Foreign keys stay enabled.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

SOURCE_DB = "finapp_mysql_phase4_src"
DEST_DB = "financial_dashboard"
MYSQL = r"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"
LOGIN_PATH = "phase4_restore"
IDENTIFIER = re.compile(r"[A-Za-z0-9_]+$")

# Counts verified when the backup was restored into the isolated source.
EXPECTED_COUNTS = {
    "accounts_user": 2,
    "access_control_permission": 24,
    "access_control_role": 3,
    "accounts_loginattempt": 28,
    "navigation_menu": 8,
    "accounts_setupstate": 1,
    "access_control_rolepermission": 38,
    "access_control_userpermissionoverride": 0,
    "access_control_userrole": 1,
    "navigation_rolemenu": 17,
    "audit_auditlog": 32,
    "token_blacklist_outstandingtoken": 10,
    "token_blacklist_blacklistedtoken": 7,
    "todos_todo": 0,
    "access_control_modulesetting": 5,
    "accounts_user_groups": 0,
    "accounts_user_user_permissions": 0,
    "auth_group": 0,
    "auth_group_permissions": 0,
    "auth_permission": 80,
    "django_admin_log": 0,
    "django_content_type": 20,
    "django_migrations": 40,
    "django_session": 0,
}

# Parents are loaded before children. navigation_menu's self-reference is
# ordered row by row.
TABLE_ORDER = [
    "accounts_user",
    "access_control_permission",
    "access_control_role",
    "accounts_loginattempt",
    "navigation_menu",
    "accounts_setupstate",
    "access_control_rolepermission",
    "access_control_userpermissionoverride",
    "access_control_userrole",
    "navigation_rolemenu",
    "audit_auditlog",
    "todos_todo",
]
UPDATE_ONLY = {"accounts_setupstate"}
EXCLUDED = {
    "django_migrations": "Django migration history is already applied on SQL Server",
    "django_content_type": "Already created by Django migrations",
    "auth_permission": "Already created by Django migrations",
    "auth_group": "Django auth table; not application data",
    "auth_group_permissions": "Django auth table; not application data",
    "django_session": "Django session table; not application data",
    "django_admin_log": "Django admin log; not application data",
    "accounts_user_groups": "Empty M2M table referencing auth_group",
    "accounts_user_user_permissions": "Empty M2M table referencing auth_permission",
    "access_control_modulesetting": (
        "Five enabled module flags with null updated_by_id; no model or reader. "
        "Kept in the MySQL backup."
    ),
    "token_blacklist_outstandingtoken": (
        "Outstanding refresh tokens are not copied. Users sign in again after cutover."
    ),
    "token_blacklist_blacklistedtoken": (
        "Blacklisted refresh tokens are not copied. Users sign in again after cutover."
    ),
}
COMPATIBLE_TYPES = {
    ("bigint", "bigint"),
    ("int", "int"),
    ("smallint", "smallint"),
    ("tinyint", "bit"),
    ("datetime", "datetimeoffset"),
    ("varchar", "nvarchar"),
    ("char", "nvarchar"),
    ("longtext", "nvarchar"),
    ("json", "nvarchar"),
}


class TransferError(RuntimeError):
    pass


def quote(name):
    if not IDENTIFIER.fullmatch(name):
        raise TransferError(f"unsafe identifier: {name}")
    return f"[{name}]"


def mysql_ident(name):
    if not IDENTIFIER.fullmatch(name):
        raise TransferError(f"unsafe identifier: {name}")
    return f"`{name}`"


def order_by_parent(rows, pk, parent, existing):
    pending = list(rows)
    ready = []
    seen = set(existing)
    while pending:
        blocked = []
        progressed = False
        for row in pending:
            parent_id = row[parent]
            if parent_id is None or parent_id in seen:
                ready.append(row)
                seen.add(row[pk])
                progressed = True
            else:
                blocked.append(row)
        if not progressed:
            raise TransferError("parent row is missing or the parent link is cyclic")
        pending = blocked
    return ready


def check_table_order(foreign_keys):
    position = {name: index for index, name in enumerate(TABLE_ORDER)}
    for child, _column, parent, _parent_column in foreign_keys:
        if child not in position:
            continue
        if parent not in position:
            raise TransferError(f"{child} references {parent}, which is not transferred")
        if child != parent and position[parent] > position[child]:
            raise TransferError(f"{child} is ordered before {parent}")


def _self_check():
    if SOURCE_DB == "financial_dashboard":
        raise TransferError("source database must stay isolated")
    ordered = order_by_parent(
        [{"id": 2, "parent_id": 1}, {"id": 1, "parent_id": None}],
        "id",
        "parent_id",
        set(),
    )
    if [row["id"] for row in ordered] != [1, 2]:
        raise TransferError("parent ordering failed")
    child = order_by_parent([{"id": 2, "parent_id": 1}], "id", "parent_id", {1})
    if [row["id"] for row in child] != [2]:
        raise TransferError("existing parent was not accepted")
    try:
        order_by_parent(
            [{"id": 1, "parent_id": 2}, {"id": 2, "parent_id": 1}],
            "id",
            "parent_id",
            set(),
        )
    except TransferError:
        return
    raise TransferError("a parent cycle was accepted")


def mysql_text(sql, xml_output=False):
    if not sql.lstrip().lower().startswith("select"):
        raise TransferError("the MySQL connection is read-only")
    command = [
        MYSQL,
        f"--login-path={LOGIN_PATH}",
        "--default-character-set=utf8mb4",
        "--batch",
        "--raw",
        SOURCE_DB,
        "-e",
        sql,
    ]
    if xml_output:
        command.insert(2, "--xml")
    else:
        command.insert(5, "-N")
    completed = subprocess.run(command, capture_output=True)
    if completed.returncode != 0:
        message = completed.stderr.decode("utf-8", "replace").strip()
        raise TransferError(message.splitlines()[-1] if message else "mysql read failed")
    return completed.stdout.decode("utf-8")


def mysql_rows(sql):
    root = ET.fromstring(mysql_text(sql, xml_output=True))
    rows = []
    for row in root.findall("row"):
        values = {}
        for field in row.findall("field"):
            nil = any(key.endswith("nil") and field.attrib[key] == "true" for key in field.attrib)
            values[field.attrib["name"]] = None if nil else (field.text or "")
        rows.append(values)
    return rows


def mysql_value(sql):
    return mysql_text(sql).strip()


def setup_django(database_name):
    if not IDENTIFIER.fullmatch(database_name):
        raise TransferError("unsafe destination database name")
    import dotenv

    dotenv.load_dotenv = lambda *_args, **_kwargs: False
    os.environ["MSSQL_DB_NAME"] = database_name
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings_sqlserver")
    os.environ.setdefault("DJANGO_ENV", "development")
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    import django

    django.setup()
    from django.conf import settings

    database = settings.DATABASES["default"]
    if database["ENGINE"] != "mssql" or database["NAME"] != database_name:
        raise TransferError("SQL Server destination does not match the requested database")


def destination_columns(cursor, table):
    cursor.execute(
        """
        SELECT c.name, ty.name, c.is_nullable, c.is_identity, c.max_length
        FROM sys.tables t
        JOIN sys.columns c ON c.object_id = t.object_id
        JOIN sys.types ty ON c.user_type_id = ty.user_type_id
        WHERE t.name = %s
        ORDER BY c.column_id
        """,
        [table],
    )
    columns = {}
    for name, type_name, nullable, identity, max_length in cursor.fetchall():
        columns[name] = {
            "type": type_name,
            "nullable": bool(nullable),
            "identity": bool(identity),
            "chars": None if max_length < 0 or type_name != "nvarchar" else max_length // 2,
        }
    if not columns:
        raise TransferError(f"destination table {table} does not exist")
    return columns


def source_columns(table):
    text = mysql_text(
        "SELECT column_name, data_type, column_type, is_nullable, column_key "
        "FROM information_schema.columns "
        f"WHERE table_schema = DATABASE() AND table_name = '{mysql_ident(table)[1:-1]}' "
        "ORDER BY ordinal_position"
    )
    columns = {}
    for line in text.splitlines():
        name, data_type, column_type, nullable, key = line.split("\t")
        columns[name] = {
            "type": data_type,
            "column_type": column_type,
            "nullable": nullable == "YES",
            "primary": key == "PRI",
        }
    if not columns:
        raise TransferError(f"source table {table} does not exist")
    return columns


def source_foreign_keys():
    text = mysql_text(
        "SELECT kcu.table_name, kcu.column_name, "
        "kcu.referenced_table_name, kcu.referenced_column_name "
        "FROM information_schema.referential_constraints rc "
        "JOIN information_schema.key_column_usage kcu "
        "ON kcu.constraint_schema = rc.constraint_schema "
        "AND kcu.constraint_name = rc.constraint_name "
        "AND kcu.referenced_table_name IS NOT NULL "
        "WHERE rc.constraint_schema = DATABASE() "
        "ORDER BY kcu.table_name, kcu.column_name"
    )
    keys = []
    for line in text.splitlines():
        if line.strip():
            keys.append(tuple(line.split("\t")))
    return keys


def convert(column, raw, source, dest):
    if raw is None:
        if not dest["nullable"]:
            raise TransferError(f"{column} is NULL and the destination column is NOT NULL")
        return None
    source_type = source["type"]
    dest_type = dest["type"]
    if dest_type == "bit":
        if raw not in {"0", "1"}:
            raise TransferError(f"{column} is not a 0/1 boolean")
        return raw == "1"
    if dest_type == "datetimeoffset":
        for pattern in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S"):
            try:
                # The verified dump was taken with time_zone '+00:00'.
                return datetime.strptime(raw, pattern).replace(tzinfo=timezone.utc)
            except ValueError:
                continue
        raise TransferError(f"{column} is not a datetime")
    if dest_type in {"bigint", "int", "smallint"}:
        try:
            value = int(raw)
        except ValueError as exc:
            raise TransferError(f"{column} is not an integer") from exc
        if source_type == "smallint" and not 0 <= value <= 32767:
            raise TransferError(f"{column} does not fit in smallint")
        return value
    if source_type == "json":
        try:
            json.loads(raw)
        except json.JSONDecodeError as exc:
            raise TransferError(f"{column} is not valid JSON") from exc
    if dest["chars"] is not None and len(raw) > dest["chars"]:
        raise TransferError(f"{column} is longer than the destination column")
    return raw


def values_match(source_value, dest_value, json_column):
    if isinstance(dest_value, Decimal):
        dest_value = int(dest_value)
    if isinstance(dest_value, datetime):
        if dest_value.tzinfo is None:
            dest_value = dest_value.replace(tzinfo=timezone.utc)
        dest_value = dest_value.astimezone(timezone.utc)
    if json_column:
        if source_value is None or dest_value is None:
            return source_value is None and dest_value is None
        return json.loads(source_value) == json.loads(dest_value)
    return source_value == dest_value


def load_destination_rows(cursor, table, columns):
    names = list(columns)
    cursor.execute(
        f"SELECT {', '.join(quote(name) for name in names)} FROM {quote(table)}"
    )
    rows = []
    for record in cursor.fetchall():
        rows.append(dict(zip(names, record)))
    return rows


def plan_rows(table, source_rows, dest_rows, parent):
    dest_by_pk = {row["id"]: row for row in dest_rows}
    unexpected = sorted(set(dest_by_pk) - {row["id"] for row in source_rows})
    if unexpected:
        raise TransferError(f"{table} has destination ids that are not in the source")
    ordered = source_rows
    if parent:
        ordered = order_by_parent(source_rows, "id", parent, set(dest_by_pk))
    actions = []
    for row in ordered:
        current = dest_by_pk.get(row["id"])
        if current is None:
            if table in UPDATE_ONLY:
                raise TransferError(f"{table} id {row['id']} is missing and cannot be inserted")
            actions.append(("insert", row))
            continue
        changed = [
            column
            for column, value in row.items()
            if not values_match(value, current[column], column in {"before", "after"})
        ]
        actions.append(("update" if changed else "skip", row))
    return actions


def action_label(actions):
    counts = {name: 0 for name in ("insert", "update", "skip")}
    for action, _row in actions:
        counts[action] += 1
    if not any(counts.values()):
        return "SKIP"
    if counts["insert"] and not counts["update"] and not counts["skip"]:
        return f"INSERT {counts['insert']}"
    if counts["update"] and not counts["insert"] and not counts["skip"]:
        return f"UPDATE {counts['update']}"
    if counts["skip"] and not counts["insert"] and not counts["update"]:
        return "SKIP" if counts["skip"] == 0 else f"SKIP {counts['skip']}"
    parts = []
    for name in ("insert", "update", "skip"):
        if counts[name]:
            parts.append(f"{name.upper()} {counts[name]}")
    return ", ".join(parts)


def apply_actions(cursor, table, actions, columns, identity):
    from django.db import transaction

    inserts = [row for action, row in actions if action == "insert"]
    updates = [row for action, row in actions if action == "update"]
    names = list(columns)
    identity_on = False
    try:
        if inserts or updates:
            if identity and inserts:
                cursor.execute(f"SET IDENTITY_INSERT {quote(table)} ON")
                identity_on = True
            for row in inserts:
                placeholders = ", ".join(["%s"] * len(names))
                cursor.execute(
                    f"INSERT INTO {quote(table)} ({', '.join(quote(name) for name in names)}) "
                    f"VALUES ({placeholders})",
                    [row[name] for name in names],
                )
            for row in updates:
                changing = [name for name in names if name != "id"]
                assignments = ", ".join(f"{quote(name)} = %s" for name in changing)
                cursor.execute(
                    f"UPDATE {quote(table)} SET {assignments} WHERE {quote('id')} = %s",
                    [row[name] for name in changing] + [row["id"]],
                )
    finally:
        if identity_on:
            try:
                cursor.execute(f"SET IDENTITY_INSERT {quote(table)} OFF")
            except Exception as exc:
                transaction.set_rollback(True)
                raise TransferError(
                    f"{table}: IDENTITY_INSERT could not be turned off; the transfer will not commit"
                ) from exc


def identity_state(cursor, table):
    cursor.execute(
        """
        SELECT CAST(ic.last_value AS bigint), CAST(ic.seed_value AS bigint),
               CAST(ic.increment_value AS bigint)
        FROM sys.identity_columns ic
        JOIN sys.tables t ON t.object_id = ic.object_id
        WHERE t.name = %s AND ic.name = 'id'
        """,
        [table],
    )
    row = cursor.fetchone()
    if row is None:
        return None
    return {"last": row[0], "seed": int(row[1]), "increment": int(row[2])}


def _consume_results(cursor):
    while True:
        try:
            cursor.fetchall()
        except Exception:
            pass
        try:
            if not cursor.nextset():
                break
        except Exception:
            break


def restore_identities(cursor, saved):
    # IDENTITY_INSERT values are not undone by ROLLBACK. Put the counter back
    # so a failed transfer leaves the same next id as before.
    for table, state in saved.items():
        if state is None:
            continue
        current = identity_state(cursor, table)
        if current is None or current["last"] == state["last"]:
            continue
        reseed = state["seed"] - state["increment"] if state["last"] is None else state["last"]
        cursor.execute(f"DBCC CHECKIDENT (N'{table}', RESEED, {int(reseed)})")
        _consume_results(cursor)


def reseed_identities(cursor, plans):
    # Verified on this SQL Server: DBCC CHECKIDENT RESEED rolls back with the
    # transaction. Keep it inside the transfer transaction.
    for table, _source_count, _dest_count, actions, _columns, identity in plans:
        if not identity or not actions:
            continue
        max_id = max(row["id"] for _action, row in actions)
        cursor.execute(f"DBCC CHECKIDENT (N'{table}', RESEED, {int(max_id)})")
        _consume_results(cursor)


def validate_loaded(cursor, plans, foreign_keys):
    for table, source_count, _dest_count, actions, _columns, _identity in plans:
        cursor.execute(f"SELECT COUNT(*) FROM {quote(table)}")
        if cursor.fetchone()[0] != source_count:
            raise TransferError(f"{table} row count does not match the source")
        if table in UPDATE_ONLY:
            source_row = actions[0][1]
            cursor.execute(
                f"SELECT {quote('is_bootstrapped')}, {quote('bootstrap_admin_id')} "
                f"FROM {quote(table)} WHERE {quote('id')} = 1"
            )
            current = cursor.fetchone()
            if current is None:
                raise TransferError("accounts_setupstate id 1 is missing")
            if bool(current[0]) != bool(source_row["is_bootstrapped"]):
                raise TransferError("accounts_setupstate was not updated")
            if current[1] != source_row["bootstrap_admin_id"]:
                raise TransferError("accounts_setupstate admin reference was not updated")
    for child, column, parent, parent_column in foreign_keys:
        if child not in TABLE_ORDER:
            continue
        cursor.execute(
            f"SELECT COUNT(*) FROM {quote(child)} child "
            f"LEFT JOIN {quote(parent)} parent "
            f"ON parent.{quote(parent_column)} = child.{quote(column)} "
            f"WHERE child.{quote(column)} IS NOT NULL "
            f"AND parent.{quote(parent_column)} IS NULL"
        )
        if cursor.fetchone()[0]:
            raise TransferError(f"orphan rows in {child}.{column}")


def snapshot(cursor):
    state = {}
    cursor.execute("SELECT COUNT(*) FROM django_migrations")
    state["migrations"] = cursor.fetchone()[0]
    for table in TABLE_ORDER:
        cursor.execute(f"SELECT COUNT(*) FROM {quote(table)}")
        state[f"count:{table}"] = cursor.fetchone()[0]
        cursor.execute(
            "SELECT c.is_identity FROM sys.tables t "
            "JOIN sys.columns c ON c.object_id = t.object_id "
            "WHERE t.name = %s AND c.name = 'id'",
            [table],
        )
        identity = cursor.fetchone()
        if identity and identity[0]:
            cursor.execute(f"SELECT CAST(IDENT_CURRENT(N'{table}') AS bigint)")
            state[f"identity:{table}"] = cursor.fetchone()[0]
    return state


def main():
    _self_check()
    parser = argparse.ArgumentParser(description="Transfer application data to SQL Server.")
    parser.add_argument("--dry-run", action="store_true", help="Report the plan and write nothing.")
    parser.add_argument("--apply", action="store_true", help="Write the planned rows.")
    parser.add_argument("--database", default=DEST_DB, help="SQL Server database to write.")
    parser.add_argument(
        "--fail-after",
        default=None,
        help="Test hook: raise after this table. Refused for financial_dashboard.",
    )
    args = parser.parse_args()
    if args.apply and args.dry_run:
        raise TransferError("choose either --dry-run or --apply")
    if args.fail_after and args.database == DEST_DB:
        raise TransferError("--fail-after is refused for financial_dashboard")
    if args.fail_after and args.fail_after not in TABLE_ORDER:
        raise TransferError(f"unknown --fail-after table {args.fail_after}")
    apply = args.apply
    setup_django(args.database)
    from django.db import connection, transaction

    foreign_keys = source_foreign_keys()
    if len(foreign_keys) != 31:
        raise TransferError(f"expected 31 source foreign keys, found {len(foreign_keys)}")
    check_table_order(
        [
            key
            for key in foreign_keys
            if key[0] in TABLE_ORDER
        ]
    )
    orphans = []
    for child, column, parent, parent_column in foreign_keys:
        count = int(
            mysql_value(
                "SELECT COUNT(*) "
                f"FROM {mysql_ident(child)} child "
                f"LEFT JOIN {mysql_ident(parent)} parent "
                f"ON parent.{mysql_ident(parent_column)} = child.{mysql_ident(column)} "
                f"WHERE child.{mysql_ident(column)} IS NOT NULL "
                f"AND parent.{mysql_ident(parent_column)} IS NULL"
            )
        )
        if count:
            orphans.append(f"{child}.{column} -> {parent}.{parent_column}: {count}")
    if orphans:
        raise TransferError("orphan foreign keys: " + "; ".join(orphans))

    for table, expected in EXPECTED_COUNTS.items():
        actual = int(mysql_value(f"SELECT COUNT(*) FROM {mysql_ident(table)}"))
        if actual != expected:
            raise TransferError(f"{table} source count {actual} != restored count {expected}")

    self_parents = {
        child: column
        for child, column, parent, _parent_column in foreign_keys
        if child == parent and child in TABLE_ORDER
    }
    try:
        _transfer(connection, transaction, args, foreign_keys, self_parents)
    except Exception:
        if apply:
            connection.close()
        raise


def _transfer(connection, transaction, args, foreign_keys, self_parents):
    apply = args.apply
    with connection.cursor() as cursor:
        before = snapshot(cursor)
        if before["migrations"] != 39:
            raise TransferError("django_migrations does not contain 39 rows")
        cursor.execute(
            """
            SELECT pt.name, pc.name, rt.name, rc.name
            FROM sys.foreign_keys fk
            JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
            JOIN sys.tables pt ON pt.object_id = fk.parent_object_id
            JOIN sys.columns pc
              ON pc.object_id = fkc.parent_object_id AND pc.column_id = fkc.parent_column_id
            JOIN sys.tables rt ON rt.object_id = fk.referenced_object_id
            JOIN sys.columns rc
              ON rc.object_id = fkc.referenced_object_id AND rc.column_id = fkc.referenced_column_id
            """
        )
        check_table_order([tuple(row) for row in cursor.fetchall()])
        plans = []
        saved_identities = {
            table: identity_state(cursor, table)
            for table in TABLE_ORDER
        }
        try:
            with transaction.atomic():
                for table in TABLE_ORDER:
                    dest_columns = destination_columns(cursor, table)
                    src_columns = source_columns(table)
                    if set(dest_columns) != set(src_columns):
                        raise TransferError(f"{table} column names differ")
                    if src_columns["id"]["primary"] is not True:
                        raise TransferError(f"{table} primary key is not id")
                    for name, source in src_columns.items():
                        pair = (source["type"], dest_columns[name]["type"])
                        if pair not in COMPATIBLE_TYPES:
                            raise TransferError(f"{table}.{name} types {pair} are incompatible")
                    selected = ", ".join(mysql_ident(name) for name in dest_columns)
                    raw_rows = mysql_rows(f"SELECT {selected} FROM {mysql_ident(table)}")
                    converted = []
                    for raw in raw_rows:
                        converted.append(
                            {
                                name: convert(
                                    f"{table}.{name}",
                                    raw[name],
                                    src_columns[name],
                                    dest_columns[name],
                                )
                                for name in dest_columns
                            }
                        )
                    dest_rows = load_destination_rows(cursor, table, dest_columns)
                    actions = plan_rows(table, converted, dest_rows, self_parents.get(table))
                    identity = any(column["identity"] for column in dest_columns.values())
                    if table in UPDATE_ONLY and identity:
                        raise TransferError(f"{table} was expected to be a non-identity primary key")
                    plans.append(
                        (table, len(raw_rows), len(dest_rows), actions, dest_columns, identity)
                    )
                if not apply:
                    transaction.set_rollback(True)
                else:
                    for table, _source_count, _dest_count, actions, columns, identity in plans:
                        try:
                            apply_actions(cursor, table, actions, columns, identity)
                        except TransferError:
                            raise
                        except Exception as exc:
                            raise TransferError(
                                f"{table} failed; the whole transfer will roll back"
                            ) from exc
                        if args.fail_after == table:
                            raise TransferError(f"induced failure after {table}")
                    validate_loaded(cursor, plans, foreign_keys)
                    reseed_identities(cursor, plans)
        except Exception:
            if apply:
                restore_identities(cursor, saved_identities)
            raise
        after = snapshot(cursor)

    print("FK_ORPHANS 0")
    print("FK_RELATIONSHIPS 31")
    print("ORDER " + " -> ".join(TABLE_ORDER))
    print("TABLE\tMYSQL\tSQLSERVER\tACTION")
    for table, source_count, dest_count, actions, _columns, identity in plans:
        print(f"{table}\t{source_count}\t{dest_count}\t{action_label(actions)}")
        if identity:
            max_id = max((row["id"] for _action, row in actions), default=None)
            reseed = "unchanged" if max_id is None else str(max_id)
            print(f"IDENTITY {table} reseed={reseed}")
        elif table in UPDATE_ONLY:
            print(f"IDENTITY {table} none; update id 1 in place")
    print("EXCLUDED")
    for table, reason in EXCLUDED.items():
        print(f"{table}\t{EXPECTED_COUNTS[table]}\t{reason}")
    if apply:
        print("APPLY complete")
        return
    if before != after:
        raise TransferError("dry-run changed SQL Server state")
    print("NO_WRITES true")
    print("MIGRATIONS 39")


if __name__ == "__main__":
    try:
        main()
    except TransferError as exc:
        print(f"ERROR {exc}", file=sys.stderr)
        sys.exit(1)
