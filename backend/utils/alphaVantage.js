// utils/alphaVantage.js
const axios = require('axios');
const {
    getMockDailyStockData,
    getMockSectorPerformance,
    getMockMarketMovers
} = require('./mockData');

const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY; // Ensure .env is loaded in server.js
const USE_MOCK_DATA = String(process.env.USE_MOCK_DATA).toLowerCase() === 'true';
const REQUEST_TIMEOUT_MS = 8000;

// A key is usable only if it exists and is not the placeholder from .env
const isApiKeyUsable = () => {
    if (!ALPHA_VANTAGE_API_KEY) return false;
    const key = ALPHA_VANTAGE_API_KEY.trim();
    if (!key) return false;
    return !key.toUpperCase().includes('YOUR_');
};

const liveDisabled = USE_MOCK_DATA || !isApiKeyUsable();

console.log(`Data mode: ${liveDisabled ? 'mock' : 'live'}`);

// Helper function to check for Alpha Vantage API errors/notes/information messages
const handleAlphaVantageError = (data) => {
    if (data && (data["Error Message"] || data["Note"] || data["Information"])) {
        const errorMessage = data["Error Message"] || data["Note"] || data["Information"];
        throw new Error(errorMessage);
    }
};

// Treat null/empty arrays/empty objects as "no usable data"
const isEmptyResult = (data) => {
    if (!data) return true;
    if (Array.isArray(data)) return data.length === 0;
    if (typeof data === 'object') {
        const values = Object.values(data);
        if (values.length === 0) return true;
        return values.every((value) => Array.isArray(value) ? value.length === 0 : false);
    }
    return false;
};

// Runs the live request; falls back to mock data on any failure or empty response.
// Always resolves to { data, source } where source is 'live' or 'mock'.
const safeFetch = async (liveFn, mockFn) => {
    if (liveDisabled) {
        return { data: mockFn(), source: 'mock' };
    }
    try {
        const data = await liveFn();
        if (isEmptyResult(data)) {
            console.warn('Alpha Vantage returned no usable data; using mock data.');
            return { data: mockFn(), source: 'mock' };
        }
        return { data, source: 'live' };
    } catch (error) {
        console.warn(`Alpha Vantage request failed (${error.message}); using mock data.`);
        return { data: mockFn(), source: 'mock' };
    }
};

// Helper function to normalize daily time series data for frontend
const normalizeDailyTimeSeries = (apiData) => {
    const timeSeries = apiData["Time Series (Daily)"];
    if (!timeSeries) return [];

    const normalizedData = [];
    for (const date in timeSeries) {
        normalizedData.push({
            date: date,
            open: parseFloat(timeSeries[date]["1. open"]),
            high: parseFloat(timeSeries[date]["2. high"]),
            low: parseFloat(timeSeries[date]["3. low"]),
            close: parseFloat(timeSeries[date]["4. close"]),
            volume: parseInt(timeSeries[date]["5. volume"])
        });
    }
    // Sort by date ascending for charting
    normalizedData.sort((a, b) => new Date(a.date) - new Date(b.date));
    return normalizedData;
};

// Function to fetch and normalize daily stock time series
const fetchDailyStockData = async (symbol) => {
    return safeFetch(
        async () => {
            const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`;
            const response = await axios.get(url, { timeout: REQUEST_TIMEOUT_MS });
            handleAlphaVantageError(response.data);
            return normalizeDailyTimeSeries(response.data);
        },
        () => getMockDailyStockData(symbol)
    );
};

// Function to fetch and normalize sector performance data
const fetchSectorPerformanceData = async () => {
    return safeFetch(
        async () => {
            const url = `https://www.alphavantage.co/query?function=SECTOR&apikey=${ALPHA_VANTAGE_API_KEY}`;
            const response = await axios.get(url, { timeout: REQUEST_TIMEOUT_MS });
            handleAlphaVantageError(response.data);

            const apiData = response.data;
            const normalizedData = [];
            const realtimeKey = Object.keys(apiData).find(key => key.startsWith("Rank A"));
            const realtimePerformance = realtimeKey ? apiData[realtimeKey] : null;

            if (realtimePerformance) {
                for (const sector in realtimePerformance) {
                    normalizedData.push({
                        sector: sector,
                        performance: parseFloat(realtimePerformance[sector].replace('%', ''))
                    });
                }
            }
            return normalizedData;
        },
        () => getMockSectorPerformance()
    );
};

// Function to fetch and normalize top gainers, losers, and most actively traded stocks
const fetchMarketMoversData = async () => {
    return safeFetch(
        async () => {
            const url = `https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=${ALPHA_VANTAGE_API_KEY}`;
            const response = await axios.get(url, { timeout: REQUEST_TIMEOUT_MS });
            handleAlphaVantageError(response.data);

            const apiData = response.data;
            const normalizedData = {
                topGainers: [],
                topLosers: [],
                mostActivelyTraded: []
            };

            if (apiData.top_gainers) {
                normalizedData.topGainers = apiData.top_gainers.map(item => ({
                    ticker: item.ticker,
                    price: parseFloat(item.price),
                    changeAmount: parseFloat(item.change_amount),
                    changePercentage: parseFloat(item.change_percentage.replace('%', '')),
                    volume: parseInt(item.volume)
                }));
            }

            if (apiData.top_losers) {
                normalizedData.topLosers = apiData.top_losers.map(item => ({
                    ticker: item.ticker,
                    price: parseFloat(item.price),
                    changeAmount: parseFloat(item.change_amount),
                    changePercentage: parseFloat(item.change_percentage.replace('%', '')),
                    volume: parseInt(item.volume)
                }));
            }

            if (apiData.most_actively_traded) {
                normalizedData.mostActivelyTraded = apiData.most_actively_traded.map(item => ({
                    ticker: item.ticker,
                    price: parseFloat(item.price),
                    changeAmount: parseFloat(item.change_amount),
                    changePercentage: parseFloat(item.change_percentage.replace('%', '')),
                    volume: parseInt(item.volume)
                }));
            }
            return normalizedData;
        },
        () => getMockMarketMovers()
    );
};

module.exports = {
    fetchDailyStockData,
    fetchSectorPerformanceData,
    fetchMarketMoversData,
    isLiveEnabled: () => !liveDisabled
};
