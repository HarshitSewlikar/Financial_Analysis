import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { queryKeys } from '../../app/queryClient'
import { getDailyStock, getMovers, getSectors, getStockScore } from '../../services/endpoints'
import { previewDaily } from './marketPreview'
import MarketDashboardPage from './MarketDashboardPage'

vi.mock('../../services/endpoints', () => ({
  getDailyStock: vi.fn(),
  getSectors: vi.fn(),
  getMovers: vi.fn(),
  getStockScore: vi.fn(),
}))

vi.mock('../../components/LineChartCard', () => ({
  default: ({ title, data, actions }) => (
    <div>
      {title} points:{data?.length ?? 0}
      {(data || []).map((row) => (
        <span key={`${row.date}-${row.close}`}>{Number(row.close).toFixed(2)}</span>
      ))}
      {actions}
    </div>
  ),
}))

vi.mock('../../components/BarChartCard', () => ({
  default: ({ title, barColor }) => (
    <div>
      {title} {barColor}
    </div>
  ),
}))

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  CartesianGrid: () => null,
  BarChart: ({ data, children }) => (
    <div>
      {(data || []).map((row) => (
        <span key={row.sector}>
          {row.sector} {row.performance}
        </span>
      ))}
      {children}
    </div>
  ),
  Bar: ({ children }) => <div>{children}</div>,
  Cell: () => null,
  XAxis: () => null,
  YAxis: () => null,
  ReferenceLine: () => null,
  Tooltip: () => null,
}))

const defer = () => {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const series = (close) =>
  Array.from({ length: 20 }, (_, index) => {
    const date = new Date()
    date.setHours(12, 0, 0, 0)
    date.setDate(date.getDate() - (19 - index))
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const price = index === 19 ? close : close - 1
    return {
      date: `${date.getFullYear()}-${month}-${day}`,
      open: price,
      high: price,
      low: price,
      close: price,
      volume: 10,
    }
  })

const ibmDaily = { data: series(333.33), source: 'live' }
const aaplDaily = { data: series(444.44), source: 'live' }
const ibmScore = {
  data: { score: 12, metrics: { volatility: '0.2000', growthRate: '0.0300', averageVolume: '3000000' } },
  source: 'live',
}
const aaplScore = {
  data: { score: 4, metrics: { volatility: '0.2000', growthRate: '0.0300', averageVolume: '3000000' } },
  source: 'live',
}
const liveSectors = { data: [{ sector: 'Energy', performance: 2.2 }], source: 'live' }
const mockSectors = { data: [{ sector: 'Energy', performance: 0.82 }], source: 'mock' }
const liveMovers = {
  data: {
    topGainers: [{ ticker: 'LIVE', price: 88.88, changeAmount: 1, changePercentage: 2.5, volume: 20 }],
    topLosers: [{ ticker: 'DOWN', price: 8, changeAmount: -1, changePercentage: -2.5, volume: 20 }],
    mostActivelyTraded: [{ ticker: 'LIVE', price: 88.88, changeAmount: 1, changePercentage: 2.5, volume: 20 }],
  },
  source: 'live',
}

let dailySlots
let scoreSlots
let sectorsSlot
let moversSlot

beforeEach(() => {
  dailySlots = {}
  scoreSlots = {}
  sectorsSlot = defer()
  moversSlot = defer()
  getDailyStock.mockImplementation((symbol) => {
    const slot = defer()
    dailySlots[symbol] = slot
    return slot.promise
  })
  getStockScore.mockImplementation((symbol) => {
    const slot = defer()
    scoreSlots[symbol] = slot
    return slot.promise
  })
  getSectors.mockImplementation(() => sectorsSlot.promise)
  getMovers.mockImplementation(() => moversSlot.promise)
})

const renderPage = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <MarketDashboardPage />
    </QueryClientProvider>,
  )
  return client
}

const heroPrice = (symbol) => {
  const close = previewDaily(symbol).data.at(-1).close
  return `$${Number(close).toFixed(2)}`
}

const ibmSample = heroPrice('IBM')
const aaplSample = heroPrice('AAPL')

const resolveRest = (sectors = liveSectors) => {
  scoreSlots.IBM.resolve(ibmScore)
  moversSlot.resolve(liveMovers)
  sectorsSlot.resolve(sectors)
}

describe('dashboard sample data', () => {
  it('shows samples until every query resolves, then keeps the API payload', async () => {
    const client = renderPage()

    expect(screen.getByLabelText('Mock data')).toHaveTextContent('M')
    expect(screen.getByText(ibmSample)).toBeInTheDocument()
    expect(screen.getByText('9 / 15')).toBeInTheDocument()
    expect(screen.getByText('Information Technology 1.84')).toBeInTheDocument()
    expect(screen.getByText('NVDA')).toBeInTheDocument()
    expect(screen.getByText('Sector return (%)')).toBeInTheDocument()
    expect(screen.queryByText('Sample data')).not.toBeInTheDocument()
    expect(screen.queryByText(/Last bar in the selected range/)).not.toBeInTheDocument()
    expect(client.getQueryData(queryKeys.marketDaily('IBM'))).toBeUndefined()

    dailySlots.IBM.resolve(ibmDaily)
    scoreSlots.IBM.resolve(ibmScore)
    moversSlot.resolve(liveMovers)

    await waitFor(() => expect(screen.getByText('$333.33')).toBeInTheDocument())
    expect(screen.getByLabelText('Mock data')).toHaveTextContent('M')
    expect(screen.queryByText(ibmSample)).not.toBeInTheDocument()
    expect(screen.getByText('Information Technology 1.84')).toBeInTheDocument()
    expect(screen.getByText('12 / 15')).toBeInTheDocument()

    sectorsSlot.resolve(liveSectors)

    await waitFor(() => expect(screen.getByLabelText('Live data')).toHaveTextContent('L'))
    expect(screen.queryByText('Information Technology 1.84')).not.toBeInTheDocument()
    expect(screen.getByText('Energy 2.2')).toBeInTheDocument()
    expect(screen.getByText(/Last bar in the selected range/)).toBeInTheDocument()
    expect(screen.getAllByText('333.33').length).toBeGreaterThan(0)

    const cached = client.getQueryData(queryKeys.marketDaily('IBM'))
    expect(cached).toBe(ibmDaily)
    expect(cached).not.toEqual(previewDaily('IBM'))
    expect(cached.data.at(-1).close).toBe(333.33)
  })

  it('removes a failed first response and shows the existing error', async () => {
    const client = renderPage()
    expect(screen.getByText(ibmSample)).toBeInTheDocument()

    dailySlots.IBM.reject(new Error('nope'))
    resolveRest()

    expect(await screen.findByText('Failed to load daily stock data.')).toBeInTheDocument()
    expect(screen.queryByText(ibmSample)).not.toBeInTheDocument()
    expect(screen.queryByText(/IBM Daily Close/)).not.toBeInTheDocument()
    expect(client.getQueryData(queryKeys.marketDaily('IBM'))).toBeUndefined()
  })

  it('keeps cached prices when a later refetch fails', async () => {
    const client = renderPage()
    dailySlots.IBM.resolve(ibmDaily)
    resolveRest()

    await screen.findByText('$333.33')

    getDailyStock.mockRejectedValue(new Error('later'))
    await client.refetchQueries({ queryKey: queryKeys.marketDaily('IBM') })

    expect(screen.getByText('$333.33')).toBeInTheDocument()
    expect(screen.queryByText('Failed to load daily stock data.')).not.toBeInTheDocument()
    expect(screen.queryByText(ibmSample)).not.toBeInTheDocument()
    expect(client.getQueryData(queryKeys.marketDaily('IBM'))).toBe(ibmDaily)
  })

  it('returns to a cached symbol without the sample note', async () => {
    const user = userEvent.setup()
    renderPage()
    dailySlots.IBM.resolve(ibmDaily)
    resolveRest()
    await screen.findByText('$333.33')

    await user.selectOptions(screen.getByLabelText('Stock'), 'AAPL')

    expect(screen.getByLabelText('Mock data')).toHaveTextContent('M')
    expect(screen.getByText(aaplSample)).toBeInTheDocument()
    expect(screen.queryByText('$333.33')).not.toBeInTheDocument()

    dailySlots.AAPL.resolve(aaplDaily)
    scoreSlots.AAPL.resolve(aaplScore)
    await screen.findByText('$444.44')
    expect(screen.getByLabelText('Live data')).toHaveTextContent('L')
    expect(screen.queryByText(aaplSample)).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Stock'), 'IBM')

    expect(screen.getByLabelText('Live data')).toHaveTextContent('L')
    expect(screen.getByText('$333.33')).toBeInTheDocument()
    expect(screen.queryByText(aaplSample)).not.toBeInTheDocument()
    expect(screen.queryByText('$444.44')).not.toBeInTheDocument()
  })

  it('keeps the mock-source notice after a sector preview', async () => {
    renderPage()
    expect(screen.getByText('Information Technology 1.84')).toBeInTheDocument()
    expect(screen.getByText('Sector return (%)')).toBeInTheDocument()
    expect(screen.queryByText(/Mock data has no defined measurement scale/)).not.toBeInTheDocument()

    dailySlots.IBM.resolve(ibmDaily)
    resolveRest(mockSectors)

    expect(await screen.findByText(/Mock data has no defined measurement scale/)).toBeInTheDocument()
    expect(screen.queryByText('Sector return (%)')).not.toBeInTheDocument()
    expect(screen.queryByText('Information Technology 1.84')).not.toBeInTheDocument()
  })
})
