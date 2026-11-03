// src/features/market/MarketDashboardPage.jsx
import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'

import LineChartCard from '../../components/LineChartCard'
import PieChartCard from '../../components/PieChartCard'
import BarChartCard from '../../components/BarChartCard'
import HeatmapCard from '../../components/HeatmapCard'
import TableComponent from '../../components/TableComponent'
import { ErrorState, Spinner } from '../../components/common/Ui'
import { queryKeys } from '../../app/queryClient'
import { filterByRange } from '../../utils/chartData'
import { getDailyStock, getMovers, getSectors, getStockScore } from '../../services/endpoints'

const STOCK_SYMBOLS = ['IBM', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA']

const TIME_RANGES = [
  { value: '1M', label: '1 Month', months: 1 },
  { value: '3M', label: '3 Months', months: 3 },
  { value: '6M', label: '6 Months', months: 6 },
  { value: '1Y', label: '1 Year', months: 12 },
  { value: 'ALL', label: 'All Time', months: null },
]

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

  const dailyData = useMemo(
    () => filterByRange(daily.data?.data, range.months),
    [daily.data, range]
  )

  const mostActiveColumns = useMemo(
    () => [
      { header: 'Ticker', accessor: 'ticker' },
      { header: 'Price', accessor: 'price', formatter: (v) => `$${Number(v).toFixed(2)}` },
      {
        header: 'Change',
        accessor: 'changeAmount',
        formatter: (v) => `${v > 0 ? '+' : ''}${Number(v).toFixed(2)}`,
      },
      {
        header: '% Change',
        accessor: 'changePercentage',
        formatter: (v) => `${Number(v).toFixed(2)}%`,
      },
      { header: 'Volume', accessor: 'volume', formatter: (v) => Number(v).toLocaleString() },
    ],
    []
  )

  const detailColumns = useMemo(
    () => [
      { header: 'Date', accessor: 'date', formatter: (v) => format(new Date(v), 'MMM dd, yyyy') },
      { header: 'Open', accessor: 'open', formatter: (v) => `$${Number(v).toFixed(2)}` },
      { header: 'High', accessor: 'high', formatter: (v) => `$${Number(v).toFixed(2)}` },
      { header: 'Low', accessor: 'low', formatter: (v) => `$${Number(v).toFixed(2)}` },
      { header: 'Close', accessor: 'close', formatter: (v) => `$${Number(v).toFixed(2)}` },
      { header: 'Volume', accessor: 'volume', formatter: (v) => Number(v).toLocaleString() },
    ],
    []
  )

  const moversData = movers.data?.data

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <label className="text-sm font-medium text-slate-700">
          Stock
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="ml-2 rounded-md border border-slate-300 px-2 py-1"
          >
            {STOCK_SYMBOLS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">
          Range
          <select
            value={range.value}
            onChange={(e) => setRange(TIME_RANGES.find((r) => r.value === e.target.value))}
            className="ml-2 rounded-md border border-slate-300 px-2 py-1"
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
          tooltipLabel="Close Price"
        />
      )}

      {sectors.isError && <ErrorState message="Failed to load sector performance." />}
      {sectors.isLoading && <Spinner label="Loading sector performance…" />}
      {sectors.data?.data && (
        <PieChartCard
          data={sectors.data.data}
          title="Sector Performance Distribution"
          dataKey="performance"
          nameKey="sector"
        />
      )}

      {movers.isError && <ErrorState message="Failed to load market movers." />}
      {moversData && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <BarChartCard
              data={moversData.topGainers.slice(0, 10)}
              title="Top 10 Gainers (%)"
              barKey="changePercentage"
              nameKey="ticker"
              barColor="#4CAF50"
            />
            <BarChartCard
              data={moversData.topLosers.slice(0, 10)}
              title="Top 10 Losers (%)"
              barKey="changePercentage"
              nameKey="ticker"
              barColor="#F44336"
            />
          </div>
          <HeatmapCard data={moversData} title="Top/Bottom Market Movers" />
        </>
      )}

      {score.isError && <ErrorState message="Failed to calculate stock score." />}
      {score.data?.data?.metrics && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-base font-semibold">{symbol} Stock Score</h3>
          <p className="mt-2 text-2xl font-bold text-slate-900">{score.data.data.score}</p>
          <div className="mt-2 grid grid-cols-3 gap-2 text-sm text-slate-600">
            <span>Volatility: {score.data.data.metrics.volatility}</span>
            <span>Growth Rate: {score.data.data.metrics.growthRate}</span>
            <span>Avg Volume: {score.data.data.metrics.averageVolume}</span>
          </div>
        </div>
      )}

      {moversData?.mostActivelyTraded && (
        <TableComponent
          data={moversData.mostActivelyTraded.slice(0, 15)}
          columns={mostActiveColumns}
          title="Most Actively Traded Stocks"
        />
      )}

      {dailyData && dailyData.length > 0 && (
        <TableComponent
          data={[dailyData[dailyData.length - 1]]}
          columns={detailColumns}
          title={`${symbol} Latest Daily Details`}
        />
      )}
    </div>
  )
}

export default MarketDashboardPage
