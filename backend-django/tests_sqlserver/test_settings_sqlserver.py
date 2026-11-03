import ast
from pathlib import Path

from django.conf import settings


def test_target_database_uses_mssql_and_windows_authentication():
    database = settings.DATABASES["default"]

    assert database["ENGINE"] == "mssql"
    assert database["Trusted_Connection"] == "yes"
    assert "Authentication" not in database["OPTIONS"]["extra_params"]


def test_target_database_has_no_sql_credentials():
    settings_path = (
        Path(__file__).resolve().parent.parent
        / "config"
        / "settings_sqlserver.py"
    )
    tree = ast.parse(settings_path.read_text(encoding="utf-8"))
    databases_node = next(
        node.value
        for node in tree.body
        if isinstance(node, ast.Assign)
        and any(
            isinstance(target, ast.Name) and target.id == "DATABASES"
            for target in node.targets
        )
    )
    default_node = next(
        value
        for key, value in zip(databases_node.keys, databases_node.values)
        if isinstance(key, ast.Constant) and key.value == "default"
    )
    database_keys = {
        key.value for key in default_node.keys if isinstance(key, ast.Constant)
    }
    options_node = next(
        value
        for key, value in zip(default_node.keys, default_node.values)
        if isinstance(key, ast.Constant) and key.value == "OPTIONS"
    )
    option_keys = {
        key.value for key in options_node.keys if isinstance(key, ast.Constant)
    }

    assert "USER" not in database_keys
    assert "PASSWORD" not in database_keys
    assert "USER" not in option_keys
    assert "PASSWORD" not in option_keys


def test_target_connection_options_are_correct():
    database = settings.DATABASES["default"]
    options = database["OPTIONS"]

    assert database["HOST"] == "."
    assert database["PORT"] == ""
    assert options["driver"] == "ODBC Driver 18 for SQL Server"
    assert options["python_driver"] == "pyodbc"
    assert options["collation"] == "Latin1_General_100_CI_AI_SC_UTF8"
    assert options["extra_params"] == (
        "Encrypt=yes;TrustServerCertificate=yes;"
    )


def test_test_database_and_connection_health_settings():
    database = settings.DATABASES["default"]

    assert database["TEST"]["NAME"] == "test_financial_dashboard"
    assert database["TEST"]["COLLATION"] == "Latin1_General_100_CI_AI_SC_UTF8"
    assert database["CONN_MAX_AGE"] == 0
    assert database["CONN_HEALTH_CHECKS"] is True
    assert settings.DATABASE_CONNECTION_POOLING is True


def test_utc_settings_and_original_settings_remain_unchanged():
    from config import settings as base_settings

    assert settings.TIME_ZONE == "UTC"
    assert settings.USE_TZ is True
    assert base_settings.TIME_ZONE == "UTC"
    assert base_settings.USE_TZ is True
    assert (
        base_settings.DATABASES["default"]["ENGINE"]
        == "django.db.backends.mysql"
    )
