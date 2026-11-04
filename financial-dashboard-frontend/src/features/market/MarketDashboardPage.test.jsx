import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useQuery } from '@tanstack/react-query'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import MarketDashboardPage from './MarketDashboardPage'

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query')
  return { ...actual, useQuery: vi.fn() }
})

vi.mock('../../components/LineChartCard', () => ({
  default: ({ title, data }) => (
    <div>
      {title} points:{data?.length ?? 0}
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

beforeAll(() => {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

const pending = { isLoading: true, isError: false, isSuccess: false, data: undefined }
const failed = { isLoading: false, isError: true, isSuccess: false, data: undefined }
const ready = (data) => ({ isLoading: false, isError: false, isSuccess: true, data: { data } })

const quote = {
  date: '2026-11-04',
  open: 294.6,
  high: 299.6,
  low: 292.3,
  close: 294.78,
  volume: 7301651,
}

const active = {
  ticker: 'TSLA',
  price: 218.75,
  changeAmount: 24.81,
  changePercentage: 2.9,
  volume: 7301651,
}

const movers = (rows) =>
  ready({
    topGainers: [{ ticker: 'AAA', changePercentage: 1.5 }],
    topLosers: [{ ticker: 'BBB', changePercentage: -2 }],
    mostActivelyTraded: rows,
  })

const install = (overrides) => {
  const states = {
    daily: ready([quote]),
    sectors: ready([]),
    movers: movers([active]),
    score: ready({}),
    ...overrides,
  }
  useQuery.mockImplementation(({ queryKey }) => states[queryKey[1]])
}

describe('dashboard market tables', () => {
  it('shows a spinner and no table while each request is loading', () => {
    install({ daily: pending, movers: pending })
    render(<MarketDashboardPage />)

    expect(screen.getByText('Loading IBM data…')).toBeInTheDocument()
    expect(screen.getByText('Loading market movers…')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByText('No daily rows for this range.')).not.toBeInTheDocument()
    expect(screen.queryByText('No actively traded stocks.')).not.toBeInTheDocument()
  })

  it('shows the existing error and does not treat a failure as an empty table', () => {
    install({ daily: failed, movers: failed })
    render(<MarketDashboardPage />)

    expect(screen.getByText('Failed to load daily stock data.')).toBeInTheDocument()
    expect(screen.getByText('Failed to load market movers.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByText('No daily rows for this range.')).not.toBeInTheDocument()
    expect(screen.queryByText('No actively traded stocks.')).not.toBeInTheDocument()
  })

  it('shows an empty state only after a successful response with no rows', () => {
    install({ daily: ready([]), movers: movers([]) })
    render(<MarketDashboardPage />)

    expect(screen.getByText('No daily rows for this range.')).toBeInTheDocument()
    expect(screen.getByText('No actively traded stocks.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByText('Failed to load daily stock data.')).not.toBeInTheDocument()
    expect(screen.queryByText('Failed to load market movers.')).not.toBeInTheDocument()
  })

  it('renders both tables with the existing price, percent, and volume text', () => {
    install()
    render(<MarketDashboardPage />)

    expect(screen.getByRole('columnheader', { name: 'Price' })).toHaveAttribute('scope', 'col')
    expect(screen.getByRole('columnheader', { name: 'Price' })).toHaveClass('text-right', 'tabular-nums')
    expect(screen.getByRole('columnheader', { name: 'Ticker' })).not.toHaveClass('text-right')
    expect(screen.getByRole('columnheader', { name: 'Open' })).toHaveClass('text-right', 'tabular-nums')
    expect(screen.getByRole('columnheader', { name: 'Date' })).not.toHaveClass('text-right')
    expect(screen.getByRole('cell', { name: '218.75' })).toHaveClass('text-right', 'tabular-nums')
    expect(screen.getByText('218.75')).toBeInTheDocument()
    expect(screen.queryByText('$218.75')).not.toBeInTheDocument()
    expect(screen.getByText('+24.81')).toBeInTheDocument()
    expect(screen.getByText('2.90%')).toBeInTheDocument()
    expect(screen.getByText('294.60')).toBeInTheDocument()
    expect(screen.getByText('294.78')).toBeInTheDocument()
    expect(screen.queryByText('$294.60')).not.toBeInTheDocument()
    expect(screen.queryByText('$294.78')).not.toBeInTheDocument()
    expect(screen.getAllByText(Number(7301651).toLocaleString())).toHaveLength(2)
    expect(screen.getByText('Top 10 Gainers (%) #065f46')).toBeInTheDocument()
    expect(screen.getByText('Top 10 Losers (%) #991b1b')).toBeInTheDocument()
    expect(screen.queryByText('Top/Bottom Market Movers')).not.toBeInTheDocument()
  })
})

const bars = (count, date, close = 294.78) =>
  Array.from({ length: count }, () => ({ ...quote, date, close }))

const scorePayload = {
  score: 9,
  metrics: { volatility: '0.4154', growthRate: '0.0200', averageVolume: '2125000' },
}

const sectorState = (source, data = [{ sector: 'Energy', performance: 0.82 }]) => ({
  isLoading: false,
  isError: false,
  isSuccess: true,
  data: { data, source },
})

describe('dashboard sector source', () => {
  it('shows the mock notice instead of a return chart', () => {
    install({ sectors: sectorState('mock') })
    render(<MarketDashboardPage />)

    expect(screen.getByText(/Mock data has no defined measurement scale/)).toBeInTheDocument()
    expect(screen.queryByText('Sector return (%)')).not.toBeInTheDocument()
    expect(screen.queryByText('0.82')).not.toBeInTheDocument()
  })

  it('shows the unknown notice when the source is missing or invalid', () => {
    install({ sectors: sectorState(undefined) })
    const view = render(<MarketDashboardPage />)

    expect(screen.getByText(/Data source and measurement units could not be verified/)).toBeInTheDocument()
    expect(screen.queryByText('Sector return (%)')).not.toBeInTheDocument()

    view.unmount()
    install({ sectors: sectorState('not-a-source') })
    render(<MarketDashboardPage />)
    expect(screen.getByText(/Data source and measurement units could not be verified/)).toBeInTheDocument()
    expect(screen.queryByText('Sector return (%)')).not.toBeInTheDocument()
  })

  it('shows the live return title only for an explicit live source', () => {
    install({
      sectors: sectorState('live', [
        { sector: 'Energy', performance: 1.25 },
        { sector: 'Financials', performance: -0.5 },
        { sector: 'Utilities', performance: 0 },
      ]),
    })
    render(<MarketDashboardPage />)

    expect(screen.getByText('Sector return (%)')).toBeInTheDocument()
    expect(screen.queryByText(/visualization unavailable/)).not.toBeInTheDocument()
  })
})

describe('dashboard score formatting', () => {
  it('converts fractional metrics and shows the score out of 15', () => {
    install({
      daily: ready(bars(20, '2026-11-04')),
      score: ready(scorePayload),
    })
    render(<MarketDashboardPage />)

    expect(screen.getByText('9 / 15')).toBeInTheDocument()
    expect(screen.getByText('41.54%')).toBeInTheDocument()
    expect(screen.getByText('2.00%')).toBeInTheDocument()
    expect(screen.getByText(Number(2125000).toLocaleString())).toBeInTheDocument()
    expect(screen.getByText('Annualized, last 20 bars')).toBeInTheDocument()
    expect(screen.getByText('Change over the last 5 closes')).toBeInTheDocument()
    expect(screen.getByText('Average over the last 20 bars')).toBeInTheDocument()
    expect(screen.queryByText('0.4154')).not.toBeInTheDocument()
    expect(screen.queryByText('0.0200')).not.toBeInTheDocument()
    expect(screen.getByText(/The selected range is not applied/)).toBeInTheDocument()
  })

  it('shows insufficient history instead of zero when fewer than 20 bars exist', () => {
    install({ daily: ready(bars(19, '2026-11-04')), score: failed })
    render(<MarketDashboardPage />)

    expect(screen.getByText(/A score needs 20 daily bars/)).toBeInTheDocument()
    expect(screen.queryByText('0 / 15')).not.toBeInTheDocument()
    expect(screen.queryByText('Failed to calculate stock score.')).not.toBeInTheDocument()
  })

  it('keeps the score error when 20 bars exist and the score request fails', () => {
    install({ daily: ready(bars(20, '2026-11-04')), score: failed })
    render(<MarketDashboardPage />)

    expect(screen.getByText('Failed to calculate stock score.')).toBeInTheDocument()
    expect(screen.queryByText(/A score needs 20 daily bars/)).not.toBeInTheDocument()
  })

  it('shows the score loading state without a previous score', () => {
    install({ daily: ready(bars(20, '2026-11-04')), score: pending })
    render(<MarketDashboardPage />)

    expect(screen.getByText('Loading stock score…')).toBeInTheDocument()
    expect(screen.queryByText(/\/ 15/)).not.toBeInTheDocument()
  })

  it('drops the previous score when the selected symbol changes', async () => {
    const user = userEvent.setup()
    useQuery.mockImplementation(({ queryKey }) => {
      if (queryKey[1] === 'daily') {
        return queryKey[2] === 'AAPL'
          ? ready(bars(20, '2026-10-02', 150.25))
          : ready(bars(20, '2026-11-04', 294.78))
      }
      if (queryKey[1] === 'score') {
        return queryKey[2] === 'AAPL' ? pending : ready(scorePayload)
      }
      if (queryKey[1] === 'sectors') return ready([])
      return movers([active])
    })
    render(<MarketDashboardPage />)

    expect(screen.getByText('9 / 15')).toBeInTheDocument()
    expect(screen.getByText('294.78')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Stock'), 'AAPL')

    expect(screen.queryByText('9 / 15')).not.toBeInTheDocument()
    expect(screen.queryByText('294.78')).not.toBeInTheDocument()
    expect(screen.getByText('150.25')).toBeInTheDocument()
    expect(screen.getByText('Oct 02, 2026')).toBeInTheDocument()
    expect(screen.getByText('Loading stock score…')).toBeInTheDocument()
  })
})

describe('dashboard range and queries', () => {
  it('changes the line series and quote with the range, and leaves the score alone', async () => {
    const user = userEvent.setup()
    const series = [{ ...quote, date: '2020-01-15', close: 10 }, ...bars(20, '2026-08-01', 180.5)]
    install({ daily: ready(series), score: ready(scorePayload) })
    render(<MarketDashboardPage />)

    expect(screen.getByText(/IBM Daily Close \(1 Year\) points:20/)).toBeInTheDocument()
    expect(screen.getByText(/Last bar in the selected range: Aug 01, 2026/)).toBeInTheDocument()
    expect(screen.getByText('9 / 15')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Range'), '1M')

    expect(screen.getByText(/IBM Daily Close \(1 Month\) points:0/)).toBeInTheDocument()
    expect(screen.getByText('No daily rows for this range.')).toBeInTheDocument()
    expect(screen.queryByText(/Aug 01, 2026/)).not.toBeInTheDocument()
    expect(screen.getByText('9 / 15')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Range'), 'ALL')

    expect(screen.getByText(/IBM Daily Close \(All Time\) points:21/)).toBeInTheDocument()
    expect(screen.getByText(/Last bar in the selected range: Aug 01, 2026/)).toBeInTheDocument()
    expect(screen.getByText('9 / 15')).toBeInTheDocument()
    expect(screen.getByText('41.54%')).toBeInTheDocument()
  })

  it('keeps the four market queries and their symbols', () => {
    useQuery.mockClear()
    install()
    render(<MarketDashboardPage />)

    const keys = useQuery.mock.calls.map((call) => call[0].queryKey)
    expect(keys).toEqual([
      ['market', 'daily', 'IBM'],
      ['market', 'sectors'],
      ['market', 'movers'],
      ['market', 'score', 'IBM'],
    ])
  })
})
