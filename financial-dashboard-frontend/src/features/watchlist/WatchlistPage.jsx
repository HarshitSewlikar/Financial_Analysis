import React, { useMemo, useState } from 'react'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '../../app/queryClient'
import { AdminPage, Badge, ConfirmDialog, Outlined, SearchField } from '../../components/admin/AdminChrome'
import LineChartCard from '../../components/LineChartCard'
import { Button, DataTable, EmptyState, ErrorState, Input, Modal, Pagination, Select, Spinner } from '../../components/common/Ui'
import { extractError } from '../../services/http'
import {
  createWatchlistItem,
  deleteWatchlistItem,
  getDailyStock,
  getStockScore,
  listWatchlist,
  updateWatchlistItem,
  watchlistSummary,
} from '../../services/endpoints'
import { usePermission } from '../auth/useAccess'
import { PriceCell, Sparkline, Stat, TickerAvatar } from '../research/ResearchBits'
import { formatChange, liveQuote } from '../research/quote'
import { COMPANIES, companySearch } from '../symbols'

const STANCES = [
  { value: 'positive', label: 'Positive' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'negative', label: 'Negative' },
]
const STANCE_TONE = { positive: 'success', neutral: 'info', negative: 'danger' }

const today = () => {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

const emptyForm = () => ({
  symbol: 'IBM',
  title: '',
  thesis: '',
  stance: 'neutral',
  note_date: today(),
})

const groupNotes = (rows) => {
  const groups = []
  rows.forEach((row) => {
    const existing = groups.find((group) => group.symbol === row.symbol)
    if (existing) existing.notes.push(row)
    else groups.push({ id: row.symbol, symbol: row.symbol, company_name: row.company_name, notes: [row] })
  })
  return groups.map((group) => {
    const notes = [...group.notes].sort((a, b) => b.note_date.localeCompare(a.note_date) || b.id - a.id)
    return { ...group, notes, latest: notes[0] }
  })
}

const WatchlistPage = () => {
  const can = usePermission()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [symbol, setSymbol] = useState('')
  const [stance, setStance] = useState('')
  const [sort, setSort] = useState('note_date')
  const [selected, setSelected] = useState(null)
  const [modal, setModal] = useState(null)
  const [confirmId, setConfirmId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState(null)

  const mapped = companySearch(query)
  const params = {
    page,
    page_size: 25,
    ...(stance ? { stance } : {}),
    ...(symbol ? { symbol } : mapped.symbol ? { symbol: mapped.symbol } : {}),
    ...(!mapped.symbol && mapped.search ? { search: mapped.search } : {}),
    ...(symbol && mapped.symbol && mapped.symbol !== symbol ? { search: query.trim() } : {}),
    ...(sort === 'symbol' ? { ordering: 'symbol' } : {}),
    ...(sort === 'note_date' ? { ordering: '-note_date' } : {}),
  }
  const items = useQuery({ queryKey: queryKeys.watchlist(params), queryFn: () => listWatchlist(params) })
  const summary = useQuery({ queryKey: queryKeys.watchlistSummary, queryFn: watchlistSummary })
  const groups = useMemo(() => groupNotes(items.data?.results || []), [items.data])
  const quotes = useQueries({
    queries: groups.map((group) => ({
      queryKey: queryKeys.marketDaily(group.symbol),
      queryFn: () => getDailyStock(group.symbol),
    })),
  })
  const quoteBySymbol = new Map(groups.map((group, index) => [group.symbol, liveQuote(quotes[index]?.data)]))
  const ordered = useMemo(() => {
    if (sort !== 'change') return groups
    return [...groups].sort((a, b) => {
      const left = quoteBySymbol.get(a.symbol)?.changePct
      const right = quoteBySymbol.get(b.symbol)?.changePct
      if (left == null && right == null) return 0
      if (left == null) return 1
      if (right == null) return -1
      return right - left
    })
  }, [groups, quoteBySymbol, sort])
  const marketAverage = useMemo(() => {
    if (ordered.length === 0 || ordered.some((group) => quoteBySymbol.get(group.symbol)?.changePct == null)) return null
    const total = ordered.reduce((sum, group) => sum + quoteBySymbol.get(group.symbol).changePct, 0)
    return total / ordered.length
  }, [ordered, quoteBySymbol])

  const detailNotes = useQuery({
    queryKey: queryKeys.watchlist({ symbol: selected, page_size: 25 }),
    queryFn: () => listWatchlist({ symbol: selected, page_size: 25 }),
    enabled: Boolean(selected),
  })
  const detailQuote = useQuery({
    queryKey: queryKeys.marketDaily(selected),
    queryFn: () => getDailyStock(selected),
    enabled: Boolean(selected),
  })
  const detailScore = useQuery({
    queryKey: queryKeys.marketScore(selected),
    queryFn: () => getStockScore(selected),
    enabled: Boolean(selected),
  })
  const quote = liveQuote(detailQuote.data)
  const metrics = detailScore.data?.source === 'live' ? detailScore.data.data?.metrics : null

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['watchlist'] })
  const saveMutation = useMutation({
    mutationFn: (payload) => (modal?.id ? updateWatchlistItem(modal.id, payload) : createWatchlistItem(payload)),
    onSuccess: () => {
      invalidate()
      setModal(null)
      setForm(emptyForm())
    },
    onError: (err) => setError(extractError(err)),
  })
  const deleteMutation = useMutation({
    mutationFn: (id) => deleteWatchlistItem(id),
    onSuccess: invalidate,
  })

  const openCreate = () => {
    setForm(emptyForm())
    setError(null)
    setModal({})
  }
  const openEdit = (row) => {
    setForm({ symbol: row.symbol, title: row.title, thesis: row.thesis, stance: row.stance, note_date: row.note_date })
    setError(null)
    setModal(row)
  }
  const submit = (event) => {
    event.preventDefault()
    setError(null)
    saveMutation.mutate({
      symbol: form.symbol,
      title: form.title.trim(),
      thesis: form.thesis.trim(),
      stance: form.stance,
      note_date: form.note_date,
    })
  }
  const clearFilters = () => {
    setQuery('')
    setSymbol('')
    setStance('')
    setSort('note_date')
    setPage(1)
  }

  const columns = [
    {
      header: 'Company',
      render: (row) => (
        <div className="flex items-center gap-2">
          <TickerAvatar symbol={row.symbol} />
          <div>
            <div className="font-semibold text-ink">{row.company_name}</div>
            <div className="text-xs text-ink-secondary">{row.symbol}</div>
          </div>
        </div>
      ),
    },
    { header: 'Price', render: (row) => <PriceCell quote={quoteBySymbol.get(row.symbol)} /> },
    {
      header: 'Trend',
      render: (row) => (quoteBySymbol.get(row.symbol) ? <Sparkline bars={quoteBySymbol.get(row.symbol).bars} /> : <span className="text-ink-muted">Unavailable</span>),
    },
    {
      header: 'Stance',
      render: (row) => <Badge tone={STANCE_TONE[row.latest.stance] || 'neutral'}>{row.latest.stance}</Badge>,
    },
    { header: 'Last note', render: (row) => row.latest.note_date },
    {
      header: 'Actions',
      render: (row) => (
        <Button variant="outline" onClick={() => setSelected(row.symbol)}>
          View
        </Button>
      ),
    },
  ]

  const detailRows = detailNotes.data?.results || []

  return (
    <AdminPage
      title="Watchlist"
      description="Research notes on the six covered companies, with the latest saved price when the market feed is live."
      actions={can('watchlist.create') && <Button icon="plus" onClick={openCreate}>New note</Button>}
    >
      <Outlined>
        {summary.isLoading ? (
          <Spinner label="Loading summary…" />
        ) : summary.isError ? (
          <ErrorState message={extractError(summary.error)} />
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Stat label="Companies" value={summary.data.companies} />
              <Stat label="Positive" value={summary.data.stances.positive} />
              <Stat label="Neutral" value={summary.data.stances.neutral} />
              <Stat label="Negative" value={summary.data.stances.negative} />
            </div>
            {marketAverage != null && (
              <p className="text-sm text-ink-secondary">
                Average daily change for the companies on this page: <span className="font-semibold text-ink">{formatChange(marketAverage)}</span>
              </p>
            )}
            <div>
              <h2 className="text-sm font-semibold text-ink">Recently updated</h2>
              {summary.data.recent.length === 0 ? (
                <p className="mt-1 text-sm text-ink-secondary">No research notes yet.</p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {summary.data.recent.map((note) => (
                    <li key={note.id}>
                      <button type="button" className="text-left text-sm text-ink hover:text-accent" onClick={() => setSelected(note.symbol)}>
                        <span className="font-semibold">{note.symbol}</span> · {note.title} · {note.note_date}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Outlined>

      <Outlined tone="tint">
        <div className="grid gap-3 md:grid-cols-4">
          <SearchField label="Search" value={query} placeholder="Company or ticker" onChange={(event) => { setPage(1); setQuery(event.target.value) }} />
          <Select label="Company" value={symbol} onChange={(event) => { setPage(1); setSymbol(event.target.value) }}>
            <option value="">All companies</option>
            {COMPANIES.map((company) => (
              <option key={company.symbol} value={company.symbol}>{company.symbol} · {company.name}</option>
            ))}
          </Select>
          <Select label="Stance" value={stance} onChange={(event) => { setPage(1); setStance(event.target.value) }}>
            <option value="">All stances</option>
            {STANCES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </Select>
          <Select label="Sort" value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="note_date">Last updated</option>
            <option value="symbol">Company</option>
            <option value="change">Price change</option>
          </Select>
        </div>
        <div className="mt-3">
          <Button variant="outline" type="button" onClick={clearFilters}>Clear filters</Button>
        </div>
      </Outlined>

      <Outlined>
        {items.isLoading ? (
          <Spinner label="Loading watchlist…" />
        ) : items.isError ? (
          <ErrorState message={extractError(items.error)} />
        ) : ordered.length === 0 ? (
          <EmptyState message="No watchlist notes yet." />
        ) : (
          <>
            <div className="hidden md:block">
              <DataTable columns={columns} rows={ordered} />
            </div>
            <ul className="space-y-3 md:hidden">
              {ordered.map((row) => (
                <li key={row.symbol} className="rounded-xl border border-line bg-surface p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <TickerAvatar symbol={row.symbol} />
                      <div>
                        <div className="font-semibold text-ink">{row.company_name}</div>
                        <div className="text-xs text-ink-secondary">{row.symbol} · {row.latest.note_date}</div>
                      </div>
                    </div>
                    <PriceCell quote={quoteBySymbol.get(row.symbol)} />
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <Badge tone={STANCE_TONE[row.latest.stance] || 'neutral'}>{row.latest.stance}</Badge>
                    <Button variant="outline" onClick={() => setSelected(row.symbol)}>View</Button>
                  </div>
                </li>
              ))}
            </ul>
            <Pagination page={page} pageSize={25} total={items.data?.count} onPageChange={setPage} />
          </>
        )}
      </Outlined>

      {selected && (
        <Outlined>
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <TickerAvatar symbol={selected} />
              <div>
                <h2 className="text-lg font-semibold text-ink">{COMPANIES.find((company) => company.symbol === selected)?.name || selected}</h2>
                <p className="text-sm text-ink-secondary">{selected}</p>
              </div>
            </div>
            <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
          </div>
          {quote ? (
            <div className="mb-3 flex flex-wrap items-end gap-4">
              <PriceCell quote={quote} />
              {quoteBySymbol.get(selected) && <Sparkline bars={quote.bars} />}
            </div>
          ) : (
            <p className="mb-3 text-sm text-ink-muted">Market data unavailable.</p>
          )}
          {metrics && (
            <div className="mb-3 flex flex-wrap gap-2">
              <Stat label="Volatility" value={metrics.volatility} />
              <Stat label="5-day growth" value={metrics.growthRate} />
              <Stat label="Avg volume" value={metrics.averageVolume} />
            </div>
          )}
          {quote && <div className="mb-4"><LineChartCard data={quote.bars} title={`${selected} close`} dataKey="close" tooltipLabel="Close" /></div>}
          {detailNotes.isLoading ? (
            <Spinner label="Loading notes…" />
          ) : detailNotes.isError ? (
            <ErrorState message={extractError(detailNotes.error)} />
          ) : (
            <ul className="space-y-3">
              {detailRows.map((note) => (
                <li key={note.id} className="rounded-xl border border-line p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-ink">{note.title}</h3>
                      <p className="text-xs text-ink-secondary">{note.note_date}</p>
                    </div>
                    <Badge tone={STANCE_TONE[note.stance] || 'neutral'}>{note.stance}</Badge>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink">{note.thesis}</p>
                  <div className="mt-3 flex gap-2">
                    {can('watchlist.update') && <Button variant="outline" onClick={() => openEdit(note)}>Edit</Button>}
                    {can('watchlist.delete') && <Button variant="danger" icon="trash" onClick={() => setConfirmId(note.id)}>Delete</Button>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Outlined>
      )}

      {confirmId !== null && (
        <ConfirmDialog
          title="Delete this note?"
          message="The note stays in the database as deleted and disappears from this list."
          confirmLabel="Delete"
          pending={deleteMutation.isPending}
          onClose={() => setConfirmId(null)}
          onConfirm={() => {
            if (deleteMutation.isPending) return
            deleteMutation.mutate(confirmId, { onSuccess: () => setConfirmId(null) })
          }}
        />
      )}

      {modal !== null && (
        <Modal title={modal.id ? 'Edit note' : 'New note'} onClose={() => setModal(null)}>
          <form onSubmit={submit} className="space-y-3">
            {error && <p className="rounded-xl border border-red-200 bg-negative-soft px-3 py-2 text-sm text-negative" role="alert">{error}</p>}
            <Select label="Company" value={form.symbol} onChange={(event) => setForm((current) => ({ ...current, symbol: event.target.value }))}>
              {COMPANIES.map((company) => (
                <option key={company.symbol} value={company.symbol}>{company.symbol} · {company.name}</option>
              ))}
            </Select>
            <Input label="Title" value={form.title} required onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
            <label className="block text-sm">
              <span className="mb-1.5 block text-sm font-semibold text-ink">Thesis</span>
              <textarea
                className="w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-sm text-ink hover:border-accent/40 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
                rows={4}
                value={form.thesis}
                required
                onChange={(event) => setForm((current) => ({ ...current, thesis: event.target.value }))}
              />
            </label>
            <Select label="Stance" value={form.stance} onChange={(event) => setForm((current) => ({ ...current, stance: event.target.value }))}>
              {STANCES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </Select>
            <Input label="Note date" type="date" value={form.note_date} required onChange={(event) => setForm((current) => ({ ...current, note_date: event.target.value }))} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" type="button" onClick={() => setModal(null)}>Cancel</Button>
              <Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Saving…' : 'Save'}</Button>
            </div>
          </form>
        </Modal>
      )}
    </AdminPage>
  )
}

export default WatchlistPage
