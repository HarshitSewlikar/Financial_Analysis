from django.urls import path

from .views import (
    DailyStockView,
    MarketMoversView,
    SectorPerformanceView,
    StockScoreView,
)

urlpatterns = [
    path("market/stock-daily/<str:symbol>/", DailyStockView.as_view(), name="market-daily"),
    path(
        "market/sector-performance/",
        SectorPerformanceView.as_view(),
        name="market-sectors",
    ),
    path("market/movers/", MarketMoversView.as_view(), name="market-movers"),
    path(
        "market/stock-score/<str:symbol>/",
        StockScoreView.as_view(),
        name="market-score",
    ),
]
