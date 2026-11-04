// src/features/market/MarketDashboardPage.jsx
import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'

import LineChartCard from '../../components/LineChartCard'
import SectorPerformanceChart from '../../components/SectorPerformanceChart'
import BarChartCard from '../../components/BarChartCard'
import { Card, DataTable, ErrorState, Spinner } from '../../components/common/Ui'
import { queryKeys } from '../../app/queryClient'
import { filterByRange } from '../../utils/chartData'
import { getDailyStock, getMovers, getSectors, getStockScore } from '../../services/endpoints'

const numericColumn = 'text-right tabular-nums'

const toDataColumns = (columns) =>
  columns.map((column) => ({
    header: column.header,
    key: column.accessor,
    className: column.className,
    render: (row) =>
      column.formatter ? column.formatter(row[column.accessor]) : row[column.accessor],
  }))

const STOCK_SYMBOLS = ['IBM', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA']

const TIME_RANGES = [
  { value: '1M', label: '1 Month', months: 1 },
  { value: '3M', label: '3 Months', months: 3 },
  { value: '6M', label: '6 Months', months: 6 },
  { value: '1Y', label: '1 Year', months: 12 },
  { value: 'ALL', label: 'All Time', months: null },
]

const formatPrice = (value) => Number(value).toFixed(2)

const formatRatioPercent = (value) => {
  const number = Number(value)
  if (!Number.isFinite(number)) return ''
  return `${(number * 100).toFixed(2)}%`
}

const formatGrouped = (value) => Number(value).toLocaleString()

const MarketDashboardPage = () => {
  const [symbol, setSymbol] = useState('IBM')
  const [range, setRange] = useState(TIME_RANGES[3])

  const daily = useQuery({
    queryKey: queryKeys.marketDaily(symbol),
    queryFn: () => getDailyStock(symbol),
  })
  const sectors = useQuery({ queryKey: queryKeys.marketSectors, queryFn: getSectors })
  const movers = useQuery({ queryKey: queryKeys.marketMovers, queryFn: getMovers })
  const score = useQuery({
    queryKey: queryKeys.marketScore(symbol),
    queryFn: () => getStockScore(symbol),
  })

  const series = Array.isArray(daily.data?.data) ? daily.data.data : []
  const dailyData = useMemo(
    () => filterByRange(daily.data?.data, range.months),
    [daily.data, range]
  )
  const quote = dailyData.length > 0 ? dailyData[dailyData.length - 1] : null
  const insufficientHistory = daily.isSuccess && series.length < 20

  const mostActiveColumns = useMemo(
    () => [
      { header: 'Ticker', accessor: 'ticker' },
      { header: 'Price', accessor: 'price', formatter: formatPrice, className: numericColumn },
      {
        header: 'Change',
        accessor: 'changeAmount',
        formatter: (v) => `${v > 0 ? '+' : ''}${Number(v).toFixed(2)}`,
        className: numericColumn,
      },
      {
        header: '% Change',
        accessor: 'changePercentage',
        formatter: (v) => `${Number(v).toFixed(2)}%`,
        className: numericColumn,
      },
      { header: 'Volume', accessor: 'volume', formatter: formatGrouped, className: numericColumn },
    ],
    []
  )

  const detailColumns = useMemo(
    () => [
      { header: 'Date', accessor: 'date', formatter: (v) => format(new Date(v), 'MMM dd, yyyy') },
      { header: 'Open', accessor: 'open', formatter: formatPrice, className: numericColumn },
      { header: 'High', accessor: 'high', formatter: formatPrice, className: numericColumn },
      { header: 'Low', accessor: 'low', formatter: formatPrice, className: numericColumn },
      { header: 'Close', accessor: 'close', formatter: formatPrice, className: numericColumn },
      { header: 'Volume', accessor: 'volume', formatter: formatGrouped, className: numericColumn },
    ],
    []
  )

  const moversData = movers.data?.data
  const metrics = score.isSuccess ? score.data?.data?.metrics : null

  return (
    <div className="space-y-6">
      <header className="page-band rounded-2xl border border-line px-5 py-5 shadow-[0_12px_32px_-24px_rgba(79,70,229,0.65)]">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Selected symbol</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Dashboard</h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-secondary">
          Price, quote, and score for one symbol. Market-wide movers stay in the section below.
        </p>
      </header>
      <section
        aria-labelledby="selected-instrument"
        className="space-y-4"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Instrument</p>
          <h2 id="selected-instrument" className="mt-1 text-3xl font-semibold tracking-tight text-ink">
            {symbol}
          </h2>
          <p className="text-sm text-ink-secondary">
            The chart and latest quote follow the selected range. The score uses this symbol&apos;s
            unfiltered daily series.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-indigo-soft px-4 py-3">
          <label className="text-sm font-medium text-ink-secondary">
            Stock
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="ml-2 min-h-11 rounded-[10px] border border-line bg-surface px-3 text-ink hover:border-accent/40 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
            >
              {STOCK_SYMBOLS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-ink-secondary">
            Range
            <select
              value={range.value}
              onChange={(e) => setRange(TIME_RANGES.find((r) => r.value === e.target.value))}
              className="ml-2 min-h-11 rounded-[10px] border border-line bg-surface px-3 text-ink hover:border-accent/40 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
            >
              {TIME_RANGES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {daily.isError && <ErrorState message="Failed to load daily stock data." />}
        {daily.isLoading && <Spinner label={`Loading ${symbol} data…`} />}
        {!daily.isLoading && !daily.isError && (
          <LineChartCard
            data={dailyData}
            title={`${symbol} Daily Close (${range.label})`}
            dataKey="close"
            tooltipLabel="Close"
          />
        )}

        {daily.isSuccess && (
          <Card title={`${symbol} Latest Daily Details`} tone="tint">
            <p className="mb-3 text-sm text-ink-secondary">
              Last bar in the selected range
              {quote ? `: ${format(new Date(quote.date), 'MMM dd, yyyy')}` : '.'}
            </p>
            <DataTable
              columns={toDataColumns(detailColumns)}
              rows={quote ? [quote] : []}
              emptyMessage="No daily rows for this range."
            />
          </Card>
        )}

        <Card title={`${symbol} stock score`}>
          {insufficientHistory ? (
            <p className="text-sm text-ink-secondary">
              Not enough history to score {symbol}. A score needs 20 daily bars.
            </p>
          ) : score.isError ? (
            <ErrorState message="Failed to calculate stock score." />
          ) : metrics ? (
            <div className="score-panel space-y-4 rounded-[14px] p-5 text-white">
              <p className="text-4xl font-semibold tracking-tight">{score.data.data.score} / 15</p>
              <p className="text-sm text-white">
                Three factors, 1, 3, or 5 points each. The selected range is not applied.
              </p>
              <div className="grid gap-3 text-sm sm:grid-cols-3">
                <div className="rounded-xl bg-white/15 p-3">
                  <p className="font-semibold">Volatility</p>
                  <p className="mt-1 text-lg font-semibold">{formatRatioPercent(metrics.volatility)}</p>
                  <p className="text-indigo-100">Annualized, last 20 bars</p>
                </div>
                <div className="rounded-xl bg-white/15 p-3">
                  <p className="font-semibold">Growth rate</p>
                  <p className="mt-1 text-lg font-semibold">{formatRatioPercent(metrics.growthRate)}</p>
                  <p className="text-indigo-100">Change over the last 5 closes</p>
                </div>
                <div className="rounded-xl bg-white/15 p-3">
                  <p className="font-semibold">Average volume</p>
                  <p className="mt-1 text-lg font-semibold">{formatGrouped(metrics.averageVolume)}</p>
                  <p className="text-indigo-100">Average over the last 20 bars</p>
                </div>
              </div>
            </div>
          ) : score.isSuccess ? null : (
            <Spinner label="Loading stock score…" />
          )}
        </Card>
      </section>

      <section aria-label="Market" className="space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal">Market</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink">Movers and sectors</h2>
        </div>
        {sectors.isError && <ErrorState message="Failed to load sector performance." />}
        {sectors.isLoading && <Spinner label="Loading sector performance…" />}
        {sectors.isSuccess && (
          <SectorPerformanceChart source={sectors.data?.source} data={sectors.data?.data} />
        )}

        {movers.isError && <ErrorState message="Failed to load market movers." />}
        {!movers.isSuccess && !movers.isError && <Spinner label="Loading market movers…" />}
        {movers.isSuccess && moversData && (
          <div className="grid gap-4 md:grid-cols-2">
            <BarChartCard
              data={moversData.topGainers.slice(0, 10)}
              title="Top 10 Gainers (%)"
              barKey="changePercentage"
              nameKey="ticker"
              barColor="#065f46"
            />
            <BarChartCard
              data={moversData.topLosers.slice(0, 10)}
              title="Top 10 Losers (%)"
              barKey="changePercentage"
              nameKey="ticker"
              barColor="#991b1b"
            />
          </div>
        )}

        {movers.isSuccess && (
          <Card title="Most Actively Traded Stocks">
            <DataTable
              columns={toDataColumns(mostActiveColumns)}
              rows={(moversData?.mostActivelyTraded ?? []).slice(0, 15)}
              emptyMessage="No actively traded stocks."
            />
          </Card>
        )}
      </section>
    </div>
  )
}

export default MarketDashboardPage
