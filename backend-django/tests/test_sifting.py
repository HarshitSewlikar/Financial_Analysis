from market_data import sifting


def test_missing_key_stays_on_mock(monkeypatch, settings):
    settings.USE_MOCK_DATA = False
    monkeypatch.delenv("SIFTING_API_KEY", raising=False)
    result = sifting.fetch_daily_stock_data("AAPL")
    assert result["source"] == "mock"


def test_daily_bars_map_to_chart_rows(monkeypatch, settings):
    settings.USE_MOCK_DATA = False
    monkeypatch.setenv("SIFTING_API_KEY", "test-key")

    def fake_get(path, params=None):
        assert path == "/v1/hist/stocks/AAPL/bars"
        assert params["interval"] == "1d"
        return {
            "data": [
                {"t": 1715760000000, "o": "1.0", "h": "2.0", "l": "0.5", "c": "1.5", "v": 10}
            ]
        }

    monkeypatch.setattr(sifting, "_get", fake_get)
    row = sifting.fetch_daily_stock_data("aapl")["data"][0]
    assert row == {
        "date": "2024-05-15",
        "open": 1.0,
        "high": 2.0,
        "low": 0.5,
        "close": 1.5,
        "volume": 10,
    }


def test_movers_and_sector_rows(monkeypatch, settings):
    settings.USE_MOCK_DATA = False
    monkeypatch.setenv("SIFTING_API_KEY", "test-key")
    calls = []

    def fake_get(path, params=None):
        calls.append(path)
        if path == "/v1/last/movers/stocks":
            return {
                "data": {
                    "gainers": [
                        {
                            "symbol": "NVDA",
                            "price": "10.5",
                            "change": "1.5",
                            "change_pct": 16.6667,
                            "day_volume": 100,
                        }
                    ],
                    "losers": [],
                }
            }
        if path == "/v1/last/most-active/stocks":
            return {"data": []}
        return {
            "data": [
                {"t": 1715673600000, "o": 1, "h": 1, "l": 1, "c": 100, "v": 1},
                {"t": 1715760000000, "o": 1, "h": 1, "l": 1, "c": 110, "v": 1},
            ]
        }

    monkeypatch.setattr(sifting, "_get", fake_get)
    movers = sifting.fetch_market_movers_data()["data"]
    assert movers["topGainers"][0]["ticker"] == "NVDA"
    assert movers["topGainers"][0]["price"] == 10.5
    assert movers["topGainers"][0]["changePercentage"] == 16.6667

    sectors = sifting.fetch_sector_performance_data()
    assert sectors["source"] == "live"
    assert sectors["data"][0] == {
        "sector": "Information Technology",
        "performance": 10.0,
    }
    assert "/v1/hist/stocks/XLK/bars" in calls
