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

from . import sqlserver_schema  # noqa: E402,F401
