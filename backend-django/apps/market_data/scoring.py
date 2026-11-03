"""Composite stock score, ported 1:1 from the legacy JavaScript implementation.

Thresholds and output structure are preserved exactly.
"""

from __future__ import annotations

import math


def calculate_stock_score(daily_data):
    if not daily_data or len(daily_data) < 20:
        return None

    recent_data = daily_data[-20:]
    growth_data = daily_data[-5:]

    returns = []
    for i in range(1, len(recent_data)):
        prev_close = recent_data[i - 1]["close"]
        current_close = recent_data[i]["close"]
        if prev_close != 0:
            returns.append((current_close - prev_close) / prev_close)

    if not returns:
        return None

    mean_return = sum(returns) / len(returns)
    squared_differences = [(r - mean_return) ** 2 for r in returns]
    variance = sum(squared_differences) / len(returns)
    volatility = math.sqrt(variance) * math.sqrt(252)

    growth_rate = 0.0
    if len(growth_data) >= 2:
        initial_price = growth_data[0]["close"]
        final_price = growth_data[-1]["close"]
        if initial_price != 0:
            growth_rate = (final_price - initial_price) / initial_price

    total_volume = sum(d["volume"] for d in recent_data)
    average_volume = total_volume / len(recent_data)

    score = 0
    factors = {}

    volatility_points = 5 if volatility < 0.2 else (3 if volatility < 0.35 else 1)
    score += volatility_points
    factors["volatility"] = {"value": f"{volatility:.4f}", "points": volatility_points}

    growth_points = 5 if growth_rate > 0.02 else (3 if growth_rate > 0 else 1)
    score += growth_points
    factors["growthRate"] = {"value": f"{growth_rate:.4f}", "points": growth_points}

    volume_points = 5 if average_volume > 5000000 else (3 if average_volume > 1000000 else 1)
    score += volume_points
    factors["averageVolume"] = {"value": f"{average_volume:.0f}", "points": volume_points}

    return {
        "score": score,
        "metrics": {
            "volatility": f"{volatility:.4f}",
            "growthRate": f"{growth_rate:.4f}",
            "averageVolume": f"{average_volume:.0f}",
        },
        "factors": factors,
    }
