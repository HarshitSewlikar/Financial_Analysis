"""Alpha Vantage HTTP client with safe mock fallback.

Mirrors the legacy JavaScript behaviour: live requests fall back to
deterministic mock data on any error, rate-limit, or empty response. Results are
always returned as ``{"data": ..., "source": "live"|"mock"}``.
"""

from __future__ import annotations

import logging

import requests
from django.conf import settings

from . import mock_data

logger = logging.getLogger(__name__)

BASE_URL = "https://www.alphavantage.co/query"


class AlphaVantageError(Exception):
    pass


def _api_key_usable() -> bool:
    key = (getattr(settings, "ALPHA_VANTAGE_API_KEY", "") or "").strip()
    if not key:
        return False
    return "YOUR_" not in key.upper()


def _live_disabled() -> bool:
    return bool(getattr(settings, "USE_MOCK_DATA", True)) or not _api_key_usable()


def _handle_errors(payload):
    if isinstance(payload, dict):
        for key in ("Error Message", "Note", "Information"):
            if payload.get(key):
                raise AlphaVantageError(str(payload[key]))


def _is_empty(data) -> bool:
    if not data:
        return True
    if isinstance(data, list):
        return len(data) == 0
    if isinstance(data, dict):
        values = list(data.values())
        if not values:
            return True
        return all(isinstance(v, list) and len(v) == 0 for v in values)
    return False


def _safe_fetch(live_fn, mock_fn):
    if _live_disabled():
        return {"data": mock_fn(), "source": "mock"}
    try:
        data = live_fn()
        if _is_empty(data):
            logger.warning("Alpha Vantage returned no usable data; using mock data.")
            return {"data": mock_fn(), "source": "mock"}
        return {"data": data, "source": "live"}
    except Exception as exc:  # noqa: BLE001 - any failure falls back to mock
        logger.warning("Alpha Vantage request failed (%s); using mock data.", exc)
        return {"data": mock_fn(), "source": "mock"}


def _get(params: dict):
    params = dict(params)
    params["apikey"] = settings.ALPHA_VANTAGE_API_KEY
    response = requests.get(
        BASE_URL, params=params, timeout=getattr(settings, "ALPHA_VANTAGE_TIMEOUT", 8)
    )
    response.raise_for_status()
    return response.json()


def normalize_daily_time_series(api_data):
    time_series = (api_data or {}).get("Time Series (Daily)")
    if not time_series:
        return []
    normalized = []
    for day, values in time_series.items():
        normalized.append(
            {
                "date": day,
                "open": float(values["1. open"]),
                "high": float(values["2. high"]),
                "low": float(values["3. low"]),
                "close": float(values["4. close"]),
                "volume": int(values["5. volume"]),
            }
        )
    normalized.sort(key=lambda row: row["date"])
    return normalized


def fetch_daily_stock_data(symbol: str):
    symbol = str(symbol).upper()

    def live():
        payload = _get(
            {"function": "TIME_SERIES_DAILY", "symbol": symbol, "outputsize": "compact"}
        )
        _handle_errors(payload)
        return normalize_daily_time_series(payload)

    return _safe_fetch(live, lambda: mock_data.get_mock_daily_stock_data(symbol))


def fetch_sector_performance_data():
    def live():
        payload = _get({"function": "SECTOR"})
        _handle_errors(payload)
        realtime_key = next(
            (key for key in payload if key.startswith("Rank A")), None
        )
        realtime = payload.get(realtime_key) if realtime_key else None
        normalized = []
        if realtime:
            for sector, value in realtime.items():
                normalized.append(
                    {"sector": sector, "performance": float(str(value).replace("%", ""))}
                )
        return normalized

    return _safe_fetch(live, mock_data.get_mock_sector_performance)


def _normalize_mover(item):
    return {
        "ticker": item["ticker"],
        "price": float(item["price"]),
        "changeAmount": float(item["change_amount"]),
        "changePercentage": float(str(item["change_percentage"]).replace("%", "")),
        "volume": int(item["volume"]),
    }


def fetch_market_movers_data():
    def live():
        payload = _get({"function": "TOP_GAINERS_LOSERS"})
        _handle_errors(payload)
        return {
            "topGainers": [
                _normalize_mover(i) for i in payload.get("top_gainers", [])
            ],
            "topLosers": [_normalize_mover(i) for i in payload.get("top_losers", [])],
            "mostActivelyTraded": [
                _normalize_mover(i) for i in payload.get("most_actively_traded", [])
            ],
        }

    return _safe_fetch(live, mock_data.get_mock_market_movers)


def is_live_enabled() -> bool:
    return not _live_disabled()
