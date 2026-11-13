const BASE_PRICES = {
  IBM: 210.4,
  AAPL: 228.15,
  MSFT: 418.6,
  GOOGL: 176.25,
  AMZN: 198.4,
  TSLA: 248.9,
}

const SCORES = {
  IBM: { score: 9, volatility: '0.1842', growthRate: '0.0126', averageVolume: '4285310' },
  AAPL: { score: 11, volatility: '0.2214', growthRate: '0.0248', averageVolume: '6120440' },
  MSFT: { score: 10, volatility: '0.1638', growthRate: '0.0181', averageVolume: '3015520' },
  GOOGL: { score: 8, volatility: '0.2411', growthRate: '0.0064', averageVolume: '2544180' },
  AMZN: { score: 9, volatility: '0.1986', growthRate: '0.0152', averageVolume: '4877600' },
  TSLA: { score: 7, volatility: '0.4128', growthRate: '-0.0084', averageVolume: '8902210' },
}

const round2 = (value) => Math.round(value * 100) / 100

const random = (seed) => {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0
    return state / 4294967296
  }
}

const seedOf = (text) => {
  let hash = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

const isoDate = (date) => {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

const tradingDates = (count) => {
  const dates = []
  const cursor = new Date()
  cursor.setHours(12, 0, 0, 0)
  while (dates.length < count) {
    const day = cursor.getDay()
    if (day !== 0 && day !== 6) dates.push(isoDate(cursor))
    cursor.setDate(cursor.getDate() - 1)
  }
  return dates.reverse()
}

export const previewDaily = (symbol) => {
  const ticker = String(symbol || 'IBM').toUpperCase()
  const rand = random(seedOf(ticker))
  let price = BASE_PRICES[ticker] ?? 180
  const data = tradingDates(90).map((date) => {
    price = Math.max(1, price * (1 + (rand() - 0.48) * 0.018))
    const close = price
    const open = Math.max(1, close * (1 + (rand() - 0.5) * 0.012))
    const high = Math.max(open, close) * (1 + rand() * 0.012)
    const low = Math.min(open, close) * (1 - rand() * 0.012)
    return {
      date,
      open: round2(open),
      high: round2(high),
      low: round2(low),
      close: round2(close),
      volume: Math.round(1400000 + rand() * 22000000),
    }
  })
  return { data, source: 'preview' }
}

export const previewScore = (symbol = 'IBM') => {
  const ticker = String(symbol || 'IBM').toUpperCase()
  const metrics = SCORES[ticker] || SCORES.IBM
  return {
    data: {
      score: metrics.score,
      metrics: {
        volatility: metrics.volatility,
        growthRate: metrics.growthRate,
        averageVolume: metrics.averageVolume,
      },
    },
    source: 'preview',
  }
}

export const previewSectors = {
  data: [
    { sector: 'Information Technology', performance: 1.84 },
    { sector: 'Communication Services', performance: 0.92 },
    { sector: 'Consumer Discretionary', performance: 0.47 },
    { sector: 'Financials', performance: 0.31 },
    { sector: 'Industrials', performance: -0.18 },
    { sector: 'Health Care', performance: -0.42 },
    { sector: 'Energy', performance: 0.64 },
    { sector: 'Consumer Staples', performance: -0.11 },
    { sector: 'Materials', performance: 0.22 },
    { sector: 'Real Estate', performance: -0.73 },
    { sector: 'Utilities', performance: 0.08 },
  ],
  source: 'preview',
}

const mover = (ticker, price, changePercentage, volume) => ({
  ticker,
  price,
  changeAmount: round2((price * changePercentage) / 100),
  changePercentage,
  volume,
})

export const previewMovers = {
  data: {
    topGainers: [
      mover('NVDA', 142.36, 6.42, 84221040),
      mover('AVGO', 186.2, 4.18, 22104550),
      mover('META', 584.11, 3.26, 18442010),
      mover('AAPL', 228.15, 2.14, 51220880),
      mover('MSFT', 418.6, 1.86, 24331840),
      mover('AMZN', 198.4, 1.54, 40112560),
      mover('AMD', 164.72, 1.22, 38990440),
      mover('NFLX', 712.4, 0.96, 6422180),
      mover('CRM', 284.55, 0.74, 5112040),
      mover('GOOGL', 176.25, 0.51, 26881420),
    ],
    topLosers: [
      mover('INTC', 22.48, -5.86, 61220480),
      mover('BA', 154.2, -4.12, 8122440),
      mover('NKE', 74.16, -3.44, 10042880),
      mover('PYPL', 62.3, -2.91, 15442010),
      mover('SNAP', 10.84, -2.48, 22104500),
      mover('COIN', 198.6, -2.06, 9422180),
      mover('RIVN', 12.42, -1.74, 30112540),
      mover('LCID', 3.18, -1.42, 28441820),
      mover('PTON', 5.66, -1.08, 8122040),
      mover('ZM', 68.4, -0.82, 4211580),
    ],
    mostActivelyTraded: [
      mover('TSLA', 248.9, 2.36, 98221040),
      mover('NVDA', 142.36, 6.42, 84221040),
      mover('AAPL', 228.15, 2.14, 51220880),
      mover('AMZN', 198.4, 1.54, 40112560),
      mover('AMD', 164.72, 1.22, 38990440),
      mover('F', 11.24, 0.84, 36221840),
      mover('BAC', 42.18, 0.42, 34112500),
      mover('PLTR', 64.55, 1.68, 30144220),
      mover('INTC', 22.48, -5.86, 61220480),
      mover('SOFI', 14.62, 1.12, 22140880),
      mover('MARA', 18.74, 3.04, 19882210),
      mover('CCL', 22.16, 0.66, 16442040),
    ],
  },
  source: 'preview',
}
