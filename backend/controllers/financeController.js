// controllers/financeController.js
const { getCachedData, setCacheData } = require('../config/cache.js');
const alphaVantage = require('../utils/alphaVantage.js');
const { calculateStockScore } = require('../utils/stockScoreCalculator.js');

// Send cached/live data along with the data-source header ('live' or 'mock')
const respondWithSource = (res, result) => {
    res.set('X-Data-Source', result.source || 'live');
    res.json(result.data);
};

// Controller for daily stock data
const getDailyStockData = async (req, res) => {
    const symbol = req.params.symbol.toUpperCase();
    const cacheKey = `daily_stock_${symbol}`;

    try {
        const cachedData = getCachedData(cacheKey, 'DAILY_STOCK');
        if (cachedData) {
            return respondWithSource(res, cachedData);
        }

        const result = await alphaVantage.fetchDailyStockData(symbol);
        setCacheData(cacheKey, result, result.source);
        respondWithSource(res, result);

    } catch (error) {
        console.error(`Error in getDailyStockData for ${symbol}:`, error.message);
        const statusCode = error.message.includes("Alpha Vantage API") ? 400 : 500;
        res.status(statusCode).json({ error: error.message });
    }
};

// Controller for sector performance
const getSectorPerformance = async (req, res) => {
    const cacheKey = 'sector_performance';

    try {
        const cachedData = getCachedData(cacheKey, 'SECTOR_PERFORMANCE');
        if (cachedData) {
            return respondWithSource(res, cachedData);
        }

        const result = await alphaVantage.fetchSectorPerformanceData();
        setCacheData(cacheKey, result, result.source);
        respondWithSource(res, result);

    } catch (error) {
        console.error('Error in getSectorPerformance:', error.message);
        const statusCode = error.message.includes("Alpha Vantage API") ? 400 : 500;
        res.status(statusCode).json({ error: error.message });
    }
};

// Controller for market movers (gainers, losers, active)
const getMarketMovers = async (req, res) => {
    const cacheKey = 'market_movers';

    try {
        const cachedData = getCachedData(cacheKey, 'TOP_LISTS');
        if (cachedData) {
            return respondWithSource(res, cachedData);
        }

        const result = await alphaVantage.fetchMarketMoversData();
        setCacheData(cacheKey, result, result.source);
        respondWithSource(res, result);

    } catch (error) {
        console.error('Error in getMarketMovers:', error.message);
        const statusCode = error.message.includes("Alpha Vantage API") ? 400 : 500;
        res.status(statusCode).json({ error: error.message });
    }
};

// Controller for stock score
const getStockScore = async (req, res) => {
    const symbol = req.params.symbol.toUpperCase();
    const cacheKey = `stock_score_${symbol}`;

    try {
        const cachedData = getCachedData(cacheKey, 'DAILY_STOCK');
        if (cachedData) {
            return respondWithSource(res, cachedData);
        }

        const dailyResult = await alphaVantage.fetchDailyStockData(symbol);
        const dailyData = dailyResult.data;

        if (!dailyData || dailyData.length === 0) {
            return res.status(404).json({ error: "No daily data available for this symbol to calculate score." });
        }

        const scoreResult = calculateStockScore(dailyData);

        if (!scoreResult) {
            return res.status(500).json({ error: "Failed to calculate stock score due to insufficient data or calculation error." });
        }

        const result = { data: scoreResult, source: dailyResult.source };
        setCacheData(cacheKey, result, result.source);
        respondWithSource(res, result);

    } catch (error) {
        console.error(`Error in getStockScore for ${symbol}:`, error.message);
        const statusCode = error.message.includes("Alpha Vantage API") ? 400 : 500;
        res.status(statusCode).json({ error: error.message });
    }
};

module.exports = {
    getDailyStockData,
    getSectorPerformance,
    getMarketMovers,
    getStockScore
};
