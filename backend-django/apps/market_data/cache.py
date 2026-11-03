"""Market-data caching with distinct live/mock TTLs (Django cache framework)."""

from __future__ import annotations

from django.conf import settings
from django.core.cache import caches

_market_cache = caches["market_data"]

# duration keys mirror the legacy cache.js names
DURATION_ATTRS = {
    "DAILY_STOCK": "MARKET_CACHE_LIVE_TTL",
    "SECTOR_PERFORMANCE": "MARKET_CACHE_LIVE_TTL",
    "TOP_LISTS": "MARKET_CACHE_LIVE_TTL",
}


def get_cached(key):
    return _market_cache.get(key)


def set_cached(key, value, source):
    if source == "mock":
        ttl = getattr(settings, "MARKET_CACHE_MOCK_TTL", 60)
    else:
        ttl = getattr(settings, "MARKET_CACHE_LIVE_TTL", 300)
    _market_cache.set(key, value, timeout=ttl)


def get_or_fetch(key: str, fetch_fn):
    """Return ``{"data", "source"}`` using a cache with source-aware TTL."""
    cached = get_cached(key)
    if cached is not None:
        return cached
    result = fetch_fn()
    set_cached(key, result, result.get("source", "live"))
    return result


def invalidate(key: str) -> None:
    _market_cache.delete(key)
