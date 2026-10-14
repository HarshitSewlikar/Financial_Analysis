"""Finance/market endpoints. All require ``market.read``."""

from __future__ import annotations

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from access_control.permissions import HasPermission

from . import alpha_vantage, cache
from .scoring import calculate_stock_score

SYMBOL_RE = r"^[A-Za-z][A-Za-z0-9.\-]{0,14}$"


def _respond(result):
    response = Response(result["data"])
    response["X-Data-Source"] = result.get("source", "live")
    return response


class DailyStockView(APIView):
    permission_classes = [HasPermission("market.read")]

    def get(self, request, symbol):
        symbol = str(symbol).upper()
        if not __import__("re").match(SYMBOL_RE, symbol):
            return Response(
                {"error": {"detail": "Invalid symbol."}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        result = cache.get_or_fetch(
            f"daily_stock_{symbol}",
            lambda: alpha_vantage.fetch_daily_stock_data(symbol),
        )
        return _respond(result)


class SectorPerformanceView(APIView):
    permission_classes = [HasPermission("market.read")]

    def get(self, request):
        result = cache.get_or_fetch(
            "sector_performance", alpha_vantage.fetch_sector_performance_data
        )
        return _respond(result)


class MarketMoversView(APIView):
    permission_classes = [HasPermission("market.read")]

    def get(self, request):
        result = cache.get_or_fetch(
            "market_movers", alpha_vantage.fetch_market_movers_data
        )
        return _respond(result)


class StockScoreView(APIView):
    permission_classes = [HasPermission("market.read")]

    def get(self, request, symbol):
        symbol = str(symbol).upper()
        if not __import__("re").match(SYMBOL_RE, symbol):
            return Response(
                {"error": {"detail": "Invalid symbol."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        def compute():
            daily = alpha_vantage.fetch_daily_stock_data(symbol)
            score = calculate_stock_score(daily["data"])
            if score is None:
                raise alpha_vantage.AlphaVantageError(
                    "Insufficient data to compute a score."
                )
            return {"data": score, "source": daily.get("source", "live")}

        result = cache.get_or_fetch(f"stock_score_{symbol}", compute)
        return _respond(result)
