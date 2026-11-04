from __future__ import annotations

import pytest

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


def test_documented_fixture_score():
    """Legacy stockScoreCalculator.js is not in this tree.

    The numbers are the documented thresholds for the 40-row fixture:
    volatility 0.4154 (1), growth 0.0202 (5), average volume 2125000 (3).
    """
    assert calculate_stock_score(_deterministic_daily()) == {
        "score": 9,
        "metrics": {
            "volatility": "0.4154",
            "growthRate": "0.0202",
            "averageVolume": "2125000",
        },
        "factors": {
            "volatility": {"value": "0.4154", "points": 1},
            "growthRate": {"value": "0.0202", "points": 5},
            "averageVolume": {"value": "2125000", "points": 3},
        },
    }


def _flat(n, close, volume):
    return [
        {
            "date": f"2025-01-{i + 1:02d}",
            "open": close,
            "high": close,
            "low": close,
            "close": close,
            "volume": volume,
        }
        for i in range(n)
    ]


def test_score_insufficient_data_returns_none():
    assert calculate_stock_score([]) is None
    assert calculate_stock_score(_deterministic_daily(10)) is None
    assert calculate_stock_score(_flat(19, 100, 100)) is None


def test_flat_minimum_window_score():
    """Twenty unchanged closes: volatility 0 (5), growth 0 (1), volume 100 (1)."""
    assert calculate_stock_score(_flat(20, 100, 100)) == {
        "score": 7,
        "metrics": {
            "volatility": "0.0000",
            "growthRate": "0.0000",
            "averageVolume": "100",
        },
        "factors": {
            "volatility": {"value": "0.0000", "points": 5},
            "growthRate": {"value": "0.0000", "points": 1},
            "averageVolume": {"value": "100", "points": 1},
        },
    }


def test_volume_threshold_is_exclusive():
    at_boundary = calculate_stock_score(_flat(20, 50, 1_000_000))
    above = calculate_stock_score(_flat(20, 50, 1_000_001))
    assert at_boundary["factors"]["averageVolume"] == {"value": "1000000", "points": 1}
    assert above["factors"]["averageVolume"] == {"value": "1000001", "points": 3}


def test_exact_two_percent_growth_scores_three_points():
    rows = _flat(20, 100, 100)
    rows[-1]["close"] = 102
    result = calculate_stock_score(rows)
    assert result["metrics"]["growthRate"] == "0.0200"
    assert result["factors"]["growthRate"]["points"] == 3


def test_all_zero_closes_have_no_returns():
    assert calculate_stock_score(_flat(20, 0, 1)) is None


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


@pytest.mark.django_db
def test_score_reuses_cached_daily_series(api, seeded, make_user, monkeypatch):
    calls = {"n": 0}

    def fake_daily(symbol):
        calls["n"] += 1
        return {"data": _flat(20, 100, 2_000_000), "source": "mock"}

    monkeypatch.setattr(
        "market_data.views.alpha_vantage.fetch_daily_stock_data", fake_daily
    )
    user = make_user("scorer", roles=("standard_user",))
    api.force_authenticate(user=user)
    assert api.get("/api/v1/market/stock-daily/IBM/").status_code == 200
    assert calls["n"] == 1
    scored = api.get("/api/v1/market/stock-score/IBM/")
    assert scored.status_code == 200
    assert scored.json()["score"] == 9
    assert calls["n"] == 1
