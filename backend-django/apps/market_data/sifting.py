"""SiftingIO client. Returns {"data", "source"} for the existing market views.

Sector bars are one-day percent changes of sector ETFs. SiftingIO has no
sector snapshot. shortcut: 11 daily requests per refresh, replace if a
sector endpoint appears.
"""

from __future__ import annotations

import logging
import os
from datetime import date, datetime, timedelta, timezone

import requests
from django.conf import settings

from . import mock_data

logger = logging.getLogger(__name__)

BASE_URL = "https://api.sifting.io"
SECTOR_ETFS = (
    ("Information Technology", "XLK"),
    ("Communication Services", "XLC"),
    ("Consumer Discretionary", "XLY"),
    ("Financials", "XLF"),
    ("Industrials", "XLI"),
    ("Health Care", "XLV"),
    ("Energy", "XLE"),
    ("Consumer Staples", "XLP"),
    ("Materials", "XLB"),
    ("Real Estate", "XLRE"),
    ("Utilities", "XLU"),
)


class SiftingError(Exception):
    pass


def key_usable() -> bool:
    key = os.environ.get("SIFTING_API_KEY", "").strip()
    return bool(key) and "YOUR_" not in key.upper()


def _live_disabled() -> bool:
    return bool(getattr(settings, "USE_MOCK_DATA", True)) or not key_usable()


def _get(path: str, params: dict | None = None):
    response = requests.get(
        f"{BASE_URL}{path}",
        params=params,
        headers={
            "X-API-Key": os.environ.get("SIFTING_API_KEY", "").strip(),
            "Accept-Encoding": "gzip",
        },
        timeout=getattr(settings, "ALPHA_VANTAGE_TIMEOUT", 8),
    )
    response.raise_for_status()
    payload = response.json()
    if isinstance(payload, dict) and payload.get("error"):
        raise SiftingError(str(payload["error"]))
    return payload


def _number(value, default=0.0) -> float:
    if value is None or value == "":
        return float(default)
    return float(value)


def _bars(symbol: str, start: str) -> list[dict]:
    payload = _get(
        f"/v1/hist/stocks/{symbol}/bars",
        {"interval": "1d", "start": start, "limit": 200},
    )
    rows = []
    for bar in payload.get("data") or []:
        rows.append(
            {
                "date": datetime.fromtimestamp(
                    bar["t"] / 1000, timezone.utc
                ).date().isoformat(),
                "open": _number(bar.get("o")),
                "high": _number(bar.get("h")),
                "low": _number(bar.get("l")),
                "close": _number(bar.get("c")),
                "volume": int(_number(bar.get("v"))),
            }
        )
    rows.sort(key=lambda row: row["date"])
    return rows


def _mover(item: dict) -> dict:
    return {
        "ticker": item.get("symbol", ""),
        "price": _number(item.get("price")),
        "changeAmount": _number(item.get("change")),
        "changePercentage": _number(item.get("change_pct")),
        "volume": int(_number(item.get("day_volume"))),
    }


def _empty(data) -> bool:
    if not data:
        return True
    if isinstance(data, list):
        return len(data) == 0
    if isinstance(data, dict):
        return all(not value for value in data.values())
    return False


def _safe_fetch(live_fn, mock_fn):
    if _live_disabled():
        return {"data": mock_fn(), "source": "mock"}
    try:
        data = live_fn()
        if _empty(data):
            logger.warning("SiftingIO returned no usable data; using mock data.")
            return {"data": mock_fn(), "source": "mock"}
        return {"data": data, "source": "live"}
    except Exception as exc:
        logger.warning("SiftingIO request failed (%s); using mock data.", exc)
        return {"data": mock_fn(), "source": "mock"}


def fetch_daily_stock_data(symbol: str):
    symbol = str(symbol).upper()
    start = (date.today() - timedelta(days=200)).isoformat()
    return _safe_fetch(
        lambda: _bars(symbol, start),
        lambda: mock_data.get_mock_daily_stock_data(symbol),
    )


def fetch_sector_performance_data():
    def live():
        start = (date.today() - timedelta(days=14)).isoformat()
        rows = []
        for name, symbol in SECTOR_ETFS:
            try:
                bars = _bars(symbol, start)
            except Exception as exc:
                logger.warning("SiftingIO sector ETF %s failed (%s).", symbol, exc)
                continue
            if len(bars) < 2 or bars[-2]["close"] == 0:
                continue
            change = (bars[-1]["close"] - bars[-2]["close"]) / bars[-2]["close"] * 100
            rows.append({"sector": name, "performance": round(change, 4)})
        return rows

    return _safe_fetch(live, mock_data.get_mock_sector_performance)


def fetch_market_movers_data():
    def live():
        movers = _get("/v1/last/movers/stocks", {"limit": 10})
        active = _get("/v1/last/most-active/stocks", {"limit": 15})
        lists = (movers.get("data") or {})
        return {
            "topGainers": [_mover(item) for item in lists.get("gainers") or []],
            "topLosers": [_mover(item) for item in lists.get("losers") or []],
            "mostActivelyTraded": [_mover(item) for item in active.get("data") or []],
        }

    return _safe_fetch(live, mock_data.get_mock_market_movers)
