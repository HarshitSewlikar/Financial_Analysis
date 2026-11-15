import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { deleteTracker, listTrackers, trackerSummary, updateTracker } from '../../services/endpoints'
import TrackersPage from './TrackersPage'

vi.mock('../../services/endpoints', () => ({
  listTrackers: vi.fn(),
  createTracker: vi.fn(),
  updateTracker: vi.fn(),
  deleteTracker: vi.fn(),
  trackerSummary: vi.fn(),
  listWatchlist: vi.fn(),
}))

vi.mock('../auth/useAccess', () => ({
  usePermission: () => () => true,
}))

const row = {
  id: 4,
  symbol: 'AAPL',
  company_name: 'Apple Inc.',
  status: 'planned',
  review_on: '2026-12-01',
  follow_up_on: null,
  summary: 'Check the next earnings note.',
}

const summary = { total: 1, planned: 1, in_review: 0, complete: 0, upcoming: 1, overdue: 0 }

const renderPage = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <TrackersPage />
    </QueryClientProvider>,
  )
}

describe('Trackers page', () => {
  it('filters by timing and updates status without opening the form', async () => {
    const user = userEvent.setup()
    listTrackers.mockResolvedValue({ count: 1, results: [row] })
    trackerSummary.mockResolvedValue(summary)
    updateTracker.mockResolvedValue({ ...row, status: 'in_review' })
    renderPage()

    await user.selectOptions(await screen.findByLabelText('Timing'), 'overdue')
    await waitFor(() => expect(listTrackers).toHaveBeenLastCalledWith(expect.objectContaining({ timing: 'overdue' })))

    await user.selectOptions(screen.getByLabelText('Status for AAPL 2026-12-01'), 'in_review')
    await waitFor(() => expect(updateTracker).toHaveBeenCalledWith(4, { status: 'in_review' }))
  })

  it('confirms once before deleting', async () => {
    const user = userEvent.setup()
    listTrackers.mockResolvedValue({ count: 1, results: [row] })
    trackerSummary.mockResolvedValue(summary)
    deleteTracker.mockResolvedValue({})
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Delete' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(deleteTracker).toHaveBeenCalledWith(4))
  })
})
