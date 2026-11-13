// src/features/market/MarketDashboardPage.jsx
import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'

import LineChartCard from '../../components/LineChartCard'
import SectorPerformanceChart from '../../components/SectorPerformanceChart'
import BarChartCard from '../../components/BarChartCard'
import { Button, Card, DataTable, ErrorState, Spinner } from '../../components/common/Ui'
import { queryKeys } from '../../app/queryClient'
import { filterByRange } from '../../utils/chartData'
import { getDailyStock, getMovers, getSectors, getStockScore } from '../../services/endpoints'
import { previewDaily, previewMovers, previewScore, previewSectors } from './marketPreview'

const isRealQuery = (query) => query.data != null && !query.isPlaceholderData
const showQueryError = (query) => Boolean(query.isError) && !isRealQuery(query)
const showQueryData = (query) => query.data != null && !showQueryError(query)

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

const COMPANY_NAMES = {
  IBM: 'International Business Machines',
  AAPL: 'Apple Inc.',
  MSFT: 'Microsoft Corporation',
  GOOGL: 'Alphabet Inc.',
  AMZN: 'Amazon.com, Inc.',
  TSLA: 'Tesla, Inc.',
}

const COMPANY_LOGOS = {
  IBM: (
    <svg viewBox="0 0 64 24" className="h-7 w-14">
      <text
        x="0"
        y="18"
        fill="#0f62fe"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="18"
        fontWeight="800"
        letterSpacing="0.4"
      >
        IBM
      </text>
    </svg>
  ),
  AAPL: (
    <svg viewBox="0 0 24 24" className="h-8 w-8">
      <path
        fill="#111827"
        d="M16.37 12.55c-.02-2.22 1.81-3.29 1.9-3.34-1.04-1.52-2.66-1.72-3.23-1.74-1.37-.14-2.68.81-3.38.81-.7 0-1.77-.79-2.91-.77-1.5.02-2.88.87-3.65 2.22-1.56 2.7-.4 6.7 1.12 8.89.74 1.07 1.62 2.28 2.78 2.24 1.12-.05 1.54-.72 2.89-.72s1.73.72 2.91.7c1.2-.02 1.96-1.09 2.69-2.17.85-1.24 1.2-2.44 1.22-2.5-.03-.01-2.33-.9-2.35-3.56zM14.6 6.4c.62-.75 1.03-1.79.92-2.83-.89.04-1.96.59-2.6 1.34-.57.66-1.07 1.71-.94 2.72 1 .08 2.01-.5 2.62-1.23z"
      />
    </svg>
  ),
  MSFT: (
    <svg viewBox="0 0 24 24" className="h-8 w-8">
      <rect x="1" y="1" width="10" height="10" fill="#f25022" />
      <rect x="13" y="1" width="10" height="10" fill="#7fba00" />
      <rect x="1" y="13" width="10" height="10" fill="#00a4ef" />
      <rect x="13" y="13" width="10" height="10" fill="#ffb900" />
    </svg>
  ),
  GOOGL: (
    <svg viewBox="0 0 24 24" className="h-8 w-8">
      <path fill="#4285F4" d="M23 12.3c0-.8-.1-1.5-.2-2.3H12v4.3h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7C21.7 18.7 23 15.8 23 12.3z" />
      <path fill="#34A853" d="M12 23c2.9 0 5.4-.9 7.2-2.6l-3.7-2.9c-1 .7-2.3 1.1-3.5 1.1-2.7 0-5-1.8-5.8-4.3H2.4v3A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M6.2 14.3a6.6 6.6 0 0 1 0-4.2V7.1H2.4a11 11 0 0 0 0 9.8l3.8-2.6z" />
      <path fill="#EA4335" d="M12 5.4c1.5 0 2.9.5 4 1.5l3-3A11 11 0 0 0 2.4 7.1l3.8 2.6C7 7.2 9.3 5.4 12 5.4z" />
    </svg>
  ),
  AMZN: (
    <svg viewBox="0 0 36 36" className="h-9 w-9">
      <text x="9" y="22" fill="#111827" fontFamily="Arial, sans-serif" fontSize="20" fontWeight="700">
        a
      </text>
      <path d="M6 25c6 5 18 5 24 0" fill="none" stroke="#ff9900" strokeWidth="2.2" strokeLinecap="round" />
      <path fill="#ff9900" d="m27 23.2 6.2 2.4-4.6 4.6z" />
    </svg>
  ),
  TSLA: (
    <svg viewBox="0 0 100 128" className="h-9 w-7">
      <path fill="#171a20" d="M10 34C28 16 72 16 90 34C72 26 28 26 10 34Z" />
      <path
        fill="#171a20"
        d="M4 52C24 36 40 32 47 34L50 42L53 34C60 32 76 36 96 52C80 58 66 60 58 62L50 124L42 62C34 60 20 58 4 52Z"
      />
    </svg>
  ),
}

const CompanyLogo = ({ symbol }) => (
  <span className="flex h-11 w-12 shrink-0 items-center justify-center" aria-hidden="true">
    {COMPANY_LOGOS[symbol]}
  </span>
)

const selectClass =
  'min-h-9 rounded-lg border border-line bg-surface px-2.5 text-sm text-ink hover:border-accent/40 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30'

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
  const [activePage, setActivePage] = useState(1)
  const [activePageSize, setActivePageSize] = useState(10)

  const daily = useQuery({
    queryKey: queryKeys.marketDaily(symbol),
    queryFn: () => getDailyStock(symbol),
    placeholderData: () => previewDaily(symbol),
  })
  const sectors = useQuery({
    queryKey: queryKeys.marketSectors,
    queryFn: getSectors,
    placeholderData: previewSectors,
  })
  const movers = useQuery({
    queryKey: queryKeys.marketMovers,
    queryFn: getMovers,
    placeholderData: previewMovers,
  })
  const score = useQuery({
    queryKey: queryKeys.marketScore(symbol),
    queryFn: () => getStockScore(symbol),
    placeholderData: () => previewScore(symbol),
  })

  const allLive = [daily, score, sectors, movers].every(isRealQuery)

  const series = Array.isArray(daily.data?.data) ? daily.data.data : []
  const dailyData = useMemo(
    () => filterByRange(daily.data?.data, range.months),
    [daily.data, range]
  )
  const quote = dailyData.length > 0 ? dailyData[dailyData.length - 1] : null
  const previous = dailyData.length > 1 ? dailyData[dailyData.length - 2] : null
  const priceChange = quote && previous ? Number(quote.close) - Number(previous.close) : null
  const priceChangePct =
    priceChange != null && Number(previous.close) !== 0
      ? (priceChange / Number(previous.close)) * 100
      : null
  const insufficientHistory = isRealQuery(daily) && series.length < 20

  const mostActiveColumns = useMemo(
    () => [
      { header: 'Ticker', accessor: 'ticker' },
      { header: 'Price', accessor: 'price', formatter: formatPrice, className: numericColumn },
      {
        header: 'Change',
        accessor: 'changeAmount',
        formatter: (v) => {
          const number = Number(v)
          const tone = number > 0 ? 'text-positive' : number < 0 ? 'text-negative' : 'text-ink'
          return <span className={`font-medium ${tone}`}>{`${number > 0 ? '+' : ''}${number.toFixed(2)}`}</span>
        },
        className: numericColumn,
      },
      {
        header: '% Change',
        accessor: 'changePercentage',
        formatter: (v) => {
          const number = Number(v)
          const tone = number > 0 ? 'text-positive' : number < 0 ? 'text-negative' : 'text-ink'
          return <span className={`font-medium ${tone}`}>{`${number.toFixed(2)}%`}</span>
        },
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
  const metrics = showQueryData(score) ? score.data?.data?.metrics : null

  const rangeControls = (
    <div className="flex flex-wrap items-center gap-2">
      <label className="text-xs font-medium text-ink-secondary">
        Stock
        <select
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          className={`ml-2 ${selectClass}`}
        >
          {STOCK_SYMBOLS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-medium text-ink-secondary">
        Range
        <select
          value={range.value}
          onChange={(e) => setRange(TIME_RANGES.find((r) => r.value === e.target.value))}
          className={`ml-2 ${selectClass}`}
        >
          {TIME_RANGES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  )

  const scoreCard = (
    <Card title={`${symbol} Stock Score`} className="h-full">
      {insufficientHistory ? (
        <p className="text-sm text-ink-secondary">
          Not enough history to score {symbol}. A score needs 20 daily bars.
        </p>
      ) : showQueryError(score) ? (
        <ErrorState message="Failed to calculate stock score." />
      ) : metrics ? (
        <div className="space-y-3">
          <p className="text-3xl font-semibold tracking-tight text-ink">{score.data.data.score} / 15</p>
          <div className="flex gap-1" aria-hidden="true">
            {Array.from({ length: 15 }, (_, index) => (
              <span
                key={index}
                className={`h-2.5 w-2.5 rounded-full ${
                  index < Number(score.data.data.score) ? 'bg-accent' : 'bg-line'
                }`}
              />
            ))}
          </div>
          <p className="text-sm text-ink-secondary">
            Three factors, 1, 3, or 5 points each. The selected range is not applied.
          </p>
          <div className="divide-y divide-line text-sm">
            <div className="flex items-center justify-between gap-3 py-2">
              <div>
                <p className="font-medium text-ink">Volatility</p>
                <p className="text-ink-secondary">Annualized, last 20 bars</p>
              </div>
              <p className="text-base font-semibold text-ink">{formatRatioPercent(metrics.volatility)}</p>
            </div>
            <div className="flex items-center justify-between gap-3 py-2">
              <div>
                <p className="font-medium text-ink">Growth rate</p>
                <p className="text-ink-secondary">Change over the last 5 closes</p>
              </div>
              <p className="text-base font-semibold text-ink">{formatRatioPercent(metrics.growthRate)}</p>
            </div>
            <div className="flex items-center justify-between gap-3 py-2">
              <div>
                <p className="font-medium text-ink">Average volume</p>
                <p className="text-ink-secondary">Average over the last 20 bars</p>
              </div>
              <p className="text-base font-semibold text-ink">{formatGrouped(metrics.averageVolume)}</p>
            </div>
          </div>
        </div>
      ) : score.isSuccess ? null : (
        <Spinner label="Loading stock score…" />
      )}
    </Card>
  )

  const activeRows = (moversData?.mostActivelyTraded ?? []).slice(0, 15)
  const activeTotal = activeRows.length
  const activePages = Math.max(1, Math.ceil(activeTotal / activePageSize) || 1)
  const activePageSafe = Math.min(activePage, activePages)
  const activeStart = (activePageSafe - 1) * activePageSize
  const activeSlice = activeRows.slice(activeStart, activeStart + activePageSize)
  const activeFrom = activeTotal === 0 ? 0 : activeStart + 1
  const activeTo = Math.min(activeStart + activePageSize, activeTotal)

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Dashboard</h1>
          <p className="mt-0.5 text-sm text-ink-secondary">Market analysis and stock performance overview</p>
        </div>
        <span
          className={`mt-1 inline-flex h-6 w-6 items-center justify-center rounded text-xs font-bold ${
            allLive ? 'bg-[#e7f8ee] text-[#15803d]' : 'bg-[#fef3c7] text-[#a16207]'
          }`}
          aria-label={allLive ? 'Live data' : 'Mock data'}
        >
          {allLive ? 'L' : 'M'}
        </span>
      </header>

      <section aria-labelledby="selected-instrument" className="space-y-5">
        <Card>
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
            <div className="flex items-center gap-3">
              <CompanyLogo symbol={symbol} />
              <div>
                <h2 id="selected-instrument" className="text-2xl font-semibold tracking-tight text-ink">
                  {symbol}
                </h2>
                <p className="text-sm text-ink-secondary">{COMPANY_NAMES[symbol] || 'Selected symbol'}</p>
              </div>
            </div>
            {quote && (
              <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
                <p className="text-3xl font-semibold tracking-tight text-accent tabular-nums">
                  ${formatPrice(quote.close)}
                </p>
                {priceChange != null && priceChangePct != null && (
                  <p className={`pb-1 text-sm font-semibold tabular-nums ${priceChange >= 0 ? 'text-positive' : 'text-negative'}`}>
                    {priceChange >= 0 ? '+' : ''}
                    {priceChange.toFixed(2)} ({priceChangePct >= 0 ? '+' : ''}
                    {priceChangePct.toFixed(2)}%)
                  </p>
                )}
                <p className="pb-1 text-xs text-ink-muted">
                  Updated {format(new Date(quote.date), 'MMM d, yyyy')}
                </p>
              </div>
            )}
          </div>
        </Card>

        <div className="grid items-stretch gap-5 min-[1100px]:grid-cols-[minmax(0,13fr)_minmax(260px,7fr)]">
          <div className="min-w-0 h-full [&>section]:h-full">
            {showQueryError(daily) && <ErrorState message="Failed to load daily stock data." />}
            {!showQueryData(daily) && !showQueryError(daily) && <Spinner label={`Loading ${symbol} data…`} />}
            {showQueryData(daily) && (
              <LineChartCard
                className="h-full"
                data={dailyData}
                title={`${symbol} Daily Close (${range.label})`}
                dataKey="close"
                tooltipLabel="Close"
                actions={rangeControls}
              />
            )}
          </div>
          {scoreCard}
        </div>

        {isRealQuery(daily) && (
          <Card title={`${symbol} Latest Daily Details`}>
            <p className="mb-2 text-sm text-ink-secondary">
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
      </section>

      <section aria-label="Market" className="space-y-5">
        <h2 className="text-lg font-semibold tracking-tight text-ink">Movers and sectors</h2>
        {showQueryError(sectors) && <ErrorState message="Failed to load sector performance." />}
        {!showQueryData(sectors) && !showQueryError(sectors) && <Spinner label="Loading sector performance…" />}
        {showQueryError(movers) && <ErrorState message="Failed to load market movers." />}
        {!showQueryData(movers) && !showQueryError(movers) && <Spinner label="Loading market movers…" />}
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]">
          {showQueryData(sectors) && (
            <SectorPerformanceChart
              preview={Boolean(sectors.isPlaceholderData)}
              source={sectors.data?.source}
              data={sectors.data?.data}
            />
          )}
          {showQueryData(movers) && moversData && (
            <>
              <BarChartCard
                data={moversData.topGainers.slice(0, 10)}
                title="Top 10 Gainers (%)"
                barKey="changePercentage"
                nameKey="ticker"
                barColor="#16a34a"
              />
              <BarChartCard
                data={moversData.topLosers.slice(0, 10)}
                title="Top 10 Losers (%)"
                barKey="changePercentage"
                nameKey="ticker"
                barColor="#dc2626"
              />
            </>
          )}
        </div>

        {showQueryData(movers) && (
          <Card title="Most Actively Traded Stocks">
            <DataTable
              columns={toDataColumns(mostActiveColumns)}
              rows={activeSlice}
              emptyMessage="No actively traded stocks."
            />
            {activeTotal > 0 && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-ink-secondary">
                <span>
                  {activeFrom}–{activeTo} of {activeTotal}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-xs font-medium text-ink-secondary">
                    Rows
                    <select
                      value={activePageSize}
                      onChange={(event) => {
                        setActivePageSize(Number(event.target.value))
                        setActivePage(1)
                      }}
                      className={`ml-2 ${selectClass}`}
                    >
                      {[5, 10, 15].map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button
                    variant="outline"
                    disabled={activePageSafe <= 1}
                    onClick={() => setActivePage(activePageSafe - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    disabled={activePageSafe >= activePages}
                    onClick={() => setActivePage(activePageSafe + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}
      </section>
    </div>
  )
}

export default MarketDashboardPage
