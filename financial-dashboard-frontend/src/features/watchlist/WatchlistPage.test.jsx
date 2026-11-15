import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { createWatchlistItem, getDailyStock, listWatchlist, watchlistSummary } from '../../services/endpoints'
import WatchlistPage from './WatchlistPage'

vi.mock('../../services/endpoints', () => ({
  listWatchlist: vi.fn(),
  createWatchlistItem: vi.fn(),
  updateWatchlistItem: vi.fn(),
  deleteWatchlistItem: vi.fn(),
  watchlistSummary: vi.fn(),
  getDailyStock: vi.fn(),
  getStockScore: vi.fn(),
}))

vi.mock('../auth/useAccess', () => ({
  usePermission: () => () => true,
}))

vi.mock('recharts', () => ({
  LineChart: ({ children }) => <div>{children}</div>,
  Line: () => null,
}))

vi.mock('../../components/LineChartCard', () => ({
  default: () => <div>Price chart</div>,
}))

const summary = {
  companies: 0,
  notes: 0,
  stances: { positive: 0, neutral: 0, negative: 0 },
  recent: [],
}

const renderPage = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <WatchlistPage />
    </QueryClientProvider>,
  )
}

describe('Watchlist page', () => {
  it('offers only the six covered companies', async () => {
    const user = userEvent.setup()
    listWatchlist.mockResolvedValue({ count: 0, results: [] })
    watchlistSummary.mockResolvedValue(summary)
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'New note' }))
    const dialog = screen.getByRole('dialog', { name: 'New note' })
    const options = [...dialog.querySelectorAll('select')][0].querySelectorAll('option')
    expect([...options].map((option) => option.value)).toEqual(['IBM', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA'])
  })

  it('keeps the form open when the save fails', async () => {
    const user = userEvent.setup()
    listWatchlist.mockResolvedValue({ count: 0, results: [] })
    watchlistSummary.mockResolvedValue(summary)
    createWatchlistItem.mockRejectedValue({ response: { data: { error: { detail: 'Thesis is required.' } } } })
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'New note' }))
    await user.type(screen.getByLabelText('Title'), 'Services mix')
    await user.type(screen.getByLabelText('Thesis'), 'Services share is growing.')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Thesis is required.')
    expect(screen.getByRole('dialog', { name: 'New note' })).toBeInTheDocument()
    await waitFor(() => expect(createWatchlistItem).toHaveBeenCalled())
  })

  it('closes the form with Escape', async () => {
    const user = userEvent.setup()
    listWatchlist.mockResolvedValue({ count: 0, results: [] })
    watchlistSummary.mockResolvedValue(summary)
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'New note' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('searches a company name as its ticker and filters by stance', async () => {
    const user = userEvent.setup()
    listWatchlist.mockResolvedValue({ count: 0, results: [] })
    watchlistSummary.mockResolvedValue(summary)
    renderPage()

    await user.type(await screen.findByLabelText('Search'), 'Apple')
    await waitFor(() => expect(listWatchlist).toHaveBeenLastCalledWith(expect.objectContaining({ symbol: 'AAPL' })))

    await user.selectOptions(screen.getByLabelText('Stance'), 'positive')
    await waitFor(() => expect(listWatchlist).toHaveBeenLastCalledWith(expect.objectContaining({ stance: 'positive', symbol: 'AAPL' })))
  })

  it('does not render a price when the market feed is mock data', async () => {
    listWatchlist.mockResolvedValue({
      count: 1,
      results: [{ id: 1, symbol: 'AAPL', company_name: 'Apple Inc.', title: 'Services', thesis: 'Growing.', stance: 'positive', note_date: '2026-11-01' }],
    })
    watchlistSummary.mockResolvedValue(summary)
    getDailyStock.mockResolvedValue({
      source: 'mock',
      data: [{ date: '2026-11-01', close: 10 }, { date: '2026-11-02', close: 12 }],
    })
    renderPage()

    expect((await screen.findAllByText('Apple Inc.')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Unavailable').length).toBeGreaterThan(0)
    expect(screen.queryByText('12.00')).not.toBeInTheDocument()
  })
})
