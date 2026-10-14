from __future__ import annotations

import json
import shutil
import subprocess
import tempfile
from pathlib import Path

import pytest
from django.conf import settings

from market_data import alpha_vantage
from market_data.mock_data import get_mock_daily_stock_data
from market_data.scoring import calculate_stock_score


def _deterministic_daily(n=40):
    rows = []
    for i in range(n):
        close = 100 + i * 0.37 + (i % 7) * 1.1 - (i % 5) * 0.9
        rows.append(
            {
                "date": f"2025-01-{i + 1:02d}",
                "open": round(close * 0.995, 2),
                "high": round(close * 1.01, 2),
                "low": round(close * 0.99, 2),
                "close": round(close, 2),
                "volume": 1_000_000 + (i % 10) * 250_000,
            }
        )
    return rows


def _node_score(daily):
    if shutil.which("node") is None:
        pytest.skip("node is not available for parity testing")
    script = Path(settings.BASE_DIR) / "tests" / "parity" / "score_parity.js"
    with tempfile.NamedTemporaryFile(
        "w", suffix=".json", delete=False, encoding="utf-8"
    ) as handle:
        json.dump(daily, handle)
        tmp_path = handle.name
    try:
        completed = subprocess.run(
            ["node", str(script), tmp_path],
            capture_output=True,
            text=True,
            check=True,
        )
    finally:
        Path(tmp_path).unlink(missing_ok=True)
    return json.loads(completed.stdout)


@pytest.mark.django_db
def test_score_parity_with_legacy_javascript():
    daily = _deterministic_daily()
    python_result = calculate_stock_score(daily)
    node_result = _node_score(daily)
    assert python_result == node_result


def test_score_insufficient_data_returns_none():
    assert calculate_stock_score([]) is None
    assert calculate_stock_score(_deterministic_daily(10)) is None


def test_normalize_daily_time_series_sorts_and_parses():
    payload = {
        "Time Series (Daily)": {
            "2025-01-03": {
                "1. open": "10.50",
                "2. high": "11.00",
                "3. low": "10.00",
                "4. close": "10.75",
                "5. volume": "1234567",
            },
            "2025-01-02": {
                "1. open": "9.00",
                "2. high": "10.60",
                "3. low": "8.90",
                "4. close": "10.50",
                "5. volume": "1000000",
            },
        }
    }
    rows = alpha_vantage.normalize_daily_time_series(payload)
    assert [r["date"] for r in rows] == ["2025-01-02", "2025-01-03"]
    assert rows[1]["close"] == 10.75
    assert rows[0]["volume"] == 1000000


def test_mock_daily_data_is_deterministic():
    first = get_mock_daily_stock_data("IBM", today=__import__("datetime").date(2025, 6, 2))
    second = get_mock_daily_stock_data("IBM", today=__import__("datetime").date(2025, 6, 2))
    assert first == second
    assert len(first) == 300
    assert first[0]["date"] < first[-1]["date"]
    assert all(set(row) == {"date", "open", "high", "low", "close", "volume"} for row in first)


@pytest.mark.django_db
def test_mock_fallback_when_live_disabled(settings):
    settings.USE_MOCK_DATA = True
    settings.ALPHA_VANTAGE_API_KEY = ""
    result = alpha_vantage.fetch_daily_stock_data("AAPL")
    assert result["source"] == "mock"
    assert len(result["data"]) == 300


@pytest.mark.django_db
def test_finance_endpoints_require_market_read(api, seeded, make_user):
    user = make_user("nomarket", roles=())
    api.force_authenticate(user=user)
    assert api.get("/api/v1/market/movers/").status_code == 403
    assert api.get("/api/v1/market/stock-daily/IBM/").status_code == 403


@pytest.mark.django_db
def test_finance_endpoints_work_with_permission(api, seeded, make_user, settings):
    settings.USE_MOCK_DATA = True
    user = make_user("hasmarket", roles=("standard_user",))
    api.force_authenticate(user=user)
    movers = api.get("/api/v1/market/movers/")
    assert movers.status_code == 200
    assert "topGainers" in movers.json()
    daily = api.get("/api/v1/market/stock-daily/IBM/")
    assert daily.status_code == 200
    assert isinstance(daily.json(), list)
