// utils/mockData.js
// Deterministic sample data used when the Alpha Vantage API is unavailable
// (no key, invalid/placeholder key, rate limit, network failure, or deprecated endpoint).

const mulberry32 = (seed) => {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

const hashString = (str) => {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
};

const round2 = (n) => Math.round(n * 100) / 100;

const BASE_PRICES = {
    IBM: 210,
    AAPL: 230,
    MSFT: 420,
    GOOGL: 175,
    AMZN: 200,
    TSLA: 250
};

const TRADING_DAYS = 300;

const getMockDailyStockData = (symbol = 'IBM') => {
    const ticker = String(symbol).toUpperCase();
    const rand = mulberry32(hashString(ticker));

    let price = BASE_PRICES[ticker] || 50 + rand() * 250;

    const dates = [];
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    while (dates.length < TRADING_DAYS) {
        const day = cursor.getDay();
        if (day !== 0 && day !== 6) {
            dates.push(new Date(cursor));
        }
        cursor.setDate(cursor.getDate() - 1);
    }
    dates.reverse();

    const data = [];
    for (const date of dates) {
        const drift = (rand() - 0.48) * 0.06;
        price = Math.max(1, price * (1 + drift));

        const close = price;
        const open = Math.max(1, close * (1 + (rand() - 0.5) * 0.01));
        const high = Math.max(open, close) * (1 + rand() * 0.02);
        const low = Math.min(open, close) * (1 - rand() * 0.02);
        const volume = Math.round(1000000 + rand() * 25000000);

        data.push({
            date: date.toISOString().slice(0, 10),
            open: round2(open),
            high: round2(high),
            low: round2(low),
            close: round2(close),
            volume
        });
    }

    return data;
};

// Alpha Vantage deprecated the SECTOR endpoint (now returns {}), so this is the
// primary source for sector performance.
const getMockSectorPerformance = () => ([
    { sector: 'Information Technology', performance: 0.82 },
    { sector: 'Communication Services', performance: 0.64 },
    { sector: 'Consumer Discretionary', performance: 0.47 },
    { sector: 'Financials', performance: 0.38 },
    { sector: 'Industrials', performance: 0.29 },
    { sector: 'Health Care', performance: 0.21 },
    { sector: 'Energy', performance: 0.15 },
    { sector: 'Consumer Staples', performance: 0.11 },
    { sector: 'Materials', performance: 0.07 },
    { sector: 'Real Estate', performance: 0.05 },
    { sector: 'Utilities', performance: 0.03 }
]);

const getMockMarketMovers = () => {
    const rand = mulberry32(hashString('market-movers'));

    const gainersPool = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'META', 'GOOGL', 'TSLA', 'AMD', 'NFLX', 'CRM', 'AVGO', 'ORCL', 'QCOM', 'INTC', 'SHOP'];
    const losersPool = ['PTON', 'RIVN', 'LCID', 'NIO', 'COIN', 'SNAP', 'ZM', 'ROKU', 'UBER', 'LYFT', 'PINS', 'SQ', 'TWLO', 'DDOG', 'OKTA'];
    const activePool = ['TSLA', 'NVDA', 'AAPL', 'AMZN', 'AMD', 'F', 'T', 'BAC', 'SOFI', 'PLTR', 'INTC', 'MARA', 'RIOT', 'CCL', 'AAL'];

    const makeRow = (ticker, positive) => {
        const price = round2(2 + rand() * 480);
        const changePercentage = (positive ? 1 : -1) * round2(1 + rand() * 25);
        const changeAmount = round2((price * changePercentage) / 100);
        const volume = Math.round(500000 + rand() * 150000000);
        return { ticker, price, changeAmount, changePercentage, volume };
    };

    const topGainers = gainersPool
        .map((ticker) => makeRow(ticker, true))
        .sort((a, b) => b.changePercentage - a.changePercentage);

    const topLosers = losersPool
        .map((ticker) => makeRow(ticker, false))
        .sort((a, b) => a.changePercentage - b.changePercentage);

    const mostActivelyTraded = activePool
        .map((ticker) => makeRow(ticker, true))
        .sort((a, b) => b.volume - a.volume);

    return { topGainers, topLosers, mostActivelyTraded };
};

module.exports = {
    getMockDailyStockData,
    getMockSectorPerformance,
    getMockMarketMovers
};
