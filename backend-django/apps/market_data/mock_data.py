"""Deterministic mock market data.

This mirrors the legacy JavaScript generator (``backend/utils/mockData.js``):
same FNV-1a string hash, same mulberry32 PRNG, same price walk. The JavaScript
version labels dates via ``Date.toISOString()`` (UTC), which can differ by one
day from local time; the Python port labels dates in local time. This is a
documented, intentional difference - the numeric series logic is equivalent for
a given seed.
"""

from __future__ import annotations

import math
from datetime import date, timedelta

MASK32 = 0xFFFFFFFF


def _to_int32(x: int) -> int:
    x &= MASK32
    return x - 0x100000000 if x >= 0x80000000 else x


def _to_uint32(x: int) -> int:
    return x & MASK32


def _imul(a: int, b: int) -> int:
    return _to_int32((_to_int32(a) * _to_int32(b)) & MASK32)


def _shr_u(x: int, n: int) -> int:
    return _to_uint32(x) >> n


def mulberry32(seed: int):
    state = _to_uint32(seed)

    def rnd() -> float:
        nonlocal state
        state = _to_int32((state + 0x6D2B79F5) & MASK32)
        t = state
        t = _imul(t ^ _shr_u(t, 15), 1 | t)
        t = _to_int32((t + _imul(t ^ _shr_u(t, 7), 61 | t)) & MASK32) ^ t
        return _to_uint32(t ^ _shr_u(t, 14)) / 4294967296

    return rnd


def hash_string(text: str) -> int:
    h = 2166136261
    for ch in text:
        h ^= ord(ch)
        h = _imul(h, 16777619)
    return _to_uint32(h)


def _round2(value: float) -> float:
    # Match JS Math.round (half toward +infinity) rather than Python's banker's.
    return math.floor(value * 100 + 0.5) / 100


BASE_PRICES = {
    "IBM": 210,
    "AAPL": 230,
    "MSFT": 420,
    "GOOGL": 175,
    "AMZN": 200,
    "TSLA": 250,
}

TRADING_DAYS = 300


def get_mock_daily_stock_data(symbol: str = "IBM", today: date | None = None):
    ticker = str(symbol or "IBM").upper()
    rand = mulberry32(hash_string(ticker))
    today = today or date.today()

    price = float(BASE_PRICES.get(ticker) or (50 + rand() * 250))

    dates = []
    cursor = today
    while len(dates) < TRADING_DAYS:
        if cursor.weekday() < 5:
            dates.append(cursor)
        cursor = cursor - timedelta(days=1)
    dates.reverse()

    data = []
    for day in dates:
        drift = (rand() - 0.48) * 0.06
        price = max(1.0, price * (1 + drift))

        close = price
        open_ = max(1.0, close * (1 + (rand() - 0.5) * 0.01))
        high = max(open_, close) * (1 + rand() * 0.02)
        low = min(open_, close) * (1 - rand() * 0.02)
        volume = round(1000000 + rand() * 25000000)

        data.append(
            {
                "date": day.isoformat(),
                "open": _round2(open_),
                "high": _round2(high),
                "low": _round2(low),
                "close": _round2(close),
                "volume": volume,
            }
        )

    return data


def get_mock_sector_performance():
    return [
        {"sector": "Information Technology", "performance": 0.82},
        {"sector": "Communication Services", "performance": 0.64},
        {"sector": "Consumer Discretionary", "performance": 0.47},
        {"sector": "Financials", "performance": 0.38},
        {"sector": "Industrials", "performance": 0.29},
        {"sector": "Health Care", "performance": 0.21},
        {"sector": "Energy", "performance": 0.15},
        {"sector": "Consumer Staples", "performance": 0.11},
        {"sector": "Materials", "performance": 0.07},
        {"sector": "Real Estate", "performance": 0.05},
        {"sector": "Utilities", "performance": 0.03},
    ]


def get_mock_market_movers():
    rand = mulberry32(hash_string("market-movers"))

    gainers_pool = [
        "AAPL", "MSFT", "NVDA", "AMZN", "META", "GOOGL", "TSLA", "AMD",
        "NFLX", "CRM", "AVGO", "ORCL", "QCOM", "INTC", "SHOP",
    ]
    losers_pool = [
        "PTON", "RIVN", "LCID", "NIO", "COIN", "SNAP", "ZM", "ROKU", "UBER",
        "LYFT", "PINS", "SQ", "TWLO", "DDOG", "OKTA",
    ]
    active_pool = [
        "TSLA", "NVDA", "AAPL", "AMZN", "AMD", "F", "T", "BAC", "SOFI",
        "PLTR", "INTC", "MARA", "RIOT", "CCL", "AAL",
    ]

    def make_row(ticker: str, positive: bool):
        price = _round2(2 + rand() * 480)
        change_percentage = (1 if positive else -1) * _round2(1 + rand() * 25)
        change_amount = _round2((price * change_percentage) / 100)
        volume = round(500000 + rand() * 150000000)
        return {
            "ticker": ticker,
            "price": price,
            "changeAmount": change_amount,
            "changePercentage": change_percentage,
            "volume": volume,
        }

    top_gainers = sorted(
        (make_row(t, True) for t in gainers_pool),
        key=lambda row: row["changePercentage"],
        reverse=True,
    )
    top_losers = sorted(
        (make_row(t, False) for t in losers_pool),
        key=lambda row: row["changePercentage"],
    )
    most_actively_traded = sorted(
        (make_row(t, True) for t in active_pool),
        key=lambda row: row["volume"],
        reverse=True,
    )

    return {
        "topGainers": top_gainers,
        "topLosers": top_losers,
        "mostActivelyTraded": most_actively_traded,
    }
