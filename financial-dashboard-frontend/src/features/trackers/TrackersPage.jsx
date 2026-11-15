import React, { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '../../app/queryClient'
import { AdminPage, Badge, ConfirmDialog, Outlined, SearchField } from '../../components/admin/AdminChrome'
import { Button, DataTable, EmptyState, ErrorState, Input, Modal, Pagination, Select, Spinner } from '../../components/common/Ui'
import { extractError } from '../../services/http'
import {
  createTracker,
  deleteTracker,
  listTrackers,
  listWatchlist,
  trackerSummary,
  updateTracker,
} from '../../services/endpoints'
import { usePermission } from '../auth/useAccess'
import { Stat, TickerAvatar } from '../research/ResearchBits'
import { reviewTiming } from '../research/quote'
import { COMPANIES, companySearch } from '../symbols'

const STATUSES = [
  { value: 'planned', label: 'Planned' },
  { value: 'in_review', label: 'In review' },
  { value: 'complete', label: 'Complete' },
]
const STATUS_TONE = { planned: 'info', in_review: 'warning', complete: 'success' }
const statusLabel = (value) => STATUSES.find((status) => status.value === value)?.label || value

const emptyForm = () => ({
  symbol: 'IBM',
  status: 'planned',
  review_on: '',
  follow_up_on: '',
  summary: '',
})

const TrackersPage = () => {
  const can = usePermission()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [symbol, setSymbol] = useState('')
  const [status, setStatus] = useState('')
  const [timing, setTiming] = useState('')
  const [sort, setSort] = useState('review_on')
  const [grouped, setGrouped] = useState(false)
  const [selected, setSelected] = useState(null)
  const [modal, setModal] = useState(null)
  const [confirmId, setConfirmId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState(null)

  const mapped = companySearch(query)
  const params = {
    page,
    page_size: 25,
    ...(status ? { status } : {}),
    ...(timing ? { timing } : {}),
    ...(symbol ? { symbol } : mapped.symbol ? { symbol: mapped.symbol } : {}),
    ...(!mapped.symbol && mapped.search ? { search: mapped.search } : {}),
    ...(symbol && mapped.symbol && mapped.symbol !== symbol ? { search: query.trim() } : {}),
    ordering: sort === 'review_on' ? 'review_on' : '-created_at',
  }
  const items = useQuery({ queryKey: queryKeys.trackers(params), queryFn: () => listTrackers(params) })
  const summary = useQuery({ queryKey: queryKeys.trackerSummary, queryFn: trackerSummary })
  const rows = items.data?.results || []
  const groups = useMemo(
    () => STATUSES.map((item) => ({ ...item, rows: rows.filter((row) => row.status === item.value) })).filter((group) => group.rows.length > 0),
    [rows],
  )
  const notes = useQuery({
    queryKey: queryKeys.watchlist({ symbol: selected?.symbol, page_size: 25 }),
    queryFn: () => listWatchlist({ symbol: selected.symbol, page_size: 25 }),
    enabled: Boolean(selected) && can('watchlist.read'),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['trackers'] })
  const saveMutation = useMutation({
    mutationFn: (payload) => (modal?.id ? updateTracker(modal.id, payload) : createTracker(payload)),
    onSuccess: () => {
      invalidate()
      setModal(null)
      setForm(emptyForm())
    },
    onError: (err) => setError(extractError(err)),
  })
  const statusMutation = useMutation({
    mutationFn: ({ id, status: next }) => updateTracker(id, { status: next }),
    onSuccess: invalidate,
  })
  const deleteMutation = useMutation({
    mutationFn: (id) => deleteTracker(id),
    onSuccess: invalidate,
  })

  const openCreate = () => {
    setForm(emptyForm())
    setError(null)
    setModal({})
  }
  const openEdit = (row) => {
    setForm({
      symbol: row.symbol,
      status: row.status,
      review_on: row.review_on,
      follow_up_on: row.follow_up_on || '',
      summary: row.summary,
    })
    setError(null)
    setModal(row)
  }
  const submit = (event) => {
    event.preventDefault()
    setError(null)
    saveMutation.mutate({
      symbol: form.symbol,
      status: form.status,
      review_on: form.review_on,
      follow_up_on: form.follow_up_on || null,
      summary: form.summary.trim(),
    })
  }
  const clearFilters = () => {
    setQuery('')
    setSymbol('')
    setStatus('')
    setTiming('')
    setSort('review_on')
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
    {
      header: 'Status',
      render: (row) => {
        const timingLabel = reviewTiming(row.review_on, row.status)
        return (
          <div className="flex flex-col items-start gap-1">
            {can('trackers.update') ? (
              <Select
                aria-label={`Status for ${row.symbol} ${row.review_on}`}
                value={row.status}
                disabled={statusMutation.isPending}
                onChange={(event) => statusMutation.mutate({ id: row.id, status: event.target.value })}
              >
                {STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </Select>
            ) : (
              <Badge tone={timingLabel.overdue ? 'danger' : STATUS_TONE[row.status]}>{statusLabel(row.status)}</Badge>
            )}
            <Badge tone={timingLabel.overdue ? 'danger' : 'neutral'}>{timingLabel.label}</Badge>
          </div>
        )
      },
    },
    { header: 'Review', key: 'review_on' },
    { header: 'Follow-up', render: (row) => row.follow_up_on || '—' },
    { header: 'Summary', key: 'summary' },
    {
      header: 'Actions',
      render: (row) => (
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setSelected(row)}>View</Button>
          {can('trackers.delete') && (
            <Button variant="danger" icon="trash" onClick={() => setConfirmId(row.id)}>Delete</Button>
          )}
        </div>
      ),
    },
  ]

  const renderTable = (tableRows) => (
    <>
      <div className="hidden md:block">
        <DataTable columns={columns} rows={tableRows} emptyMessage="No trackers in this group." />
      </div>
      <ul className="space-y-3 md:hidden">
        {tableRows.map((row) => {
          const timingLabel = reviewTiming(row.review_on, row.status)
          return (
            <li key={row.id} className="rounded-xl border border-line bg-surface p-3">
              <div className="flex items-center gap-2">
                <TickerAvatar symbol={row.symbol} />
                <div>
                  <div className="font-semibold text-ink">{row.company_name}</div>
                  <div className="text-xs text-ink-secondary">{row.symbol} · {row.review_on}</div>
                </div>
              </div>
              <p className="mt-2 text-sm text-ink">{row.summary}</p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <Badge tone={timingLabel.overdue ? 'danger' : STATUS_TONE[row.status]}>{timingLabel.label}</Badge>
                <Button variant="outline" onClick={() => setSelected(row)}>View</Button>
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )

  const selectedTiming = selected ? reviewTiming(selected.review_on, selected.status) : null

  return (
    <AdminPage
      title="Trackers"
      description="Review records for the six covered companies. A tracker is a research review, not a holding."
      actions={can('trackers.create') && <Button icon="plus" onClick={openCreate}>New tracker</Button>}
    >
      <Outlined>
        {summary.isLoading ? (
          <Spinner label="Loading summary…" />
        ) : summary.isError ? (
          <ErrorState message={extractError(summary.error)} />
        ) : (
          <div className="flex flex-wrap gap-2">
            <Stat label="Total" value={summary.data.total} />
            <Stat label="Planned" value={summary.data.planned} />
            <Stat label="In review" value={summary.data.in_review} />
            <Stat label="Complete" value={summary.data.complete} />
            <Stat label="Upcoming" value={summary.data.upcoming} />
            <Stat label="Overdue" value={summary.data.overdue} />
          </div>
        )}
      </Outlined>

      <Outlined tone="tint">
        <div className="grid gap-3 md:grid-cols-4">
          <SearchField label="Search" value={query} placeholder="Company or ticker" onChange={(event) => { setPage(1); setQuery(event.target.value) }} />
          <Select label="Status" value={status} onChange={(event) => { setPage(1); setStatus(event.target.value) }}>
            <option value="">All statuses</option>
            {STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </Select>
          <Select label="Timing" value={timing} onChange={(event) => { setPage(1); setTiming(event.target.value) }}>
            <option value="">All dates</option>
            <option value="upcoming">Upcoming</option>
            <option value="overdue">Overdue</option>
            <option value="complete">Completed</option>
          </Select>
          <Select label="Sort" value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="review_on">Review date</option>
            <option value="created">Newest saved</option>
          </Select>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button variant="outline" type="button" onClick={clearFilters}>Clear filters</Button>
          <label className="flex items-center gap-2 text-sm font-medium text-ink">
            <input type="checkbox" checked={grouped} onChange={(event) => setGrouped(event.target.checked)} />
            Group by status
          </label>
        </div>
      </Outlined>

      <Outlined>
        {items.isLoading ? (
          <Spinner label="Loading trackers…" />
        ) : items.isError ? (
          <ErrorState message={extractError(items.error)} />
        ) : rows.length === 0 ? (
          <EmptyState message="No trackers yet." />
        ) : grouped ? (
          <div className="space-y-5">
            {groups.map((group) => (
              <section key={group.value}>
                <h2 className="mb-2 text-sm font-semibold text-ink">{group.label}</h2>
                {renderTable(group.rows)}
              </section>
            ))}
            <Pagination page={page} pageSize={25} total={items.data?.count} onPageChange={setPage} />
          </div>
        ) : (
          <>
            {renderTable(rows)}
            <Pagination page={page} pageSize={25} total={items.data?.count} onPageChange={setPage} />
          </>
        )}
      </Outlined>

      {selected && (
        <Outlined>
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <TickerAvatar symbol={selected.symbol} />
              <div>
                <h2 className="text-lg font-semibold text-ink">{selected.company_name}</h2>
                <p className="text-sm text-ink-secondary">{selected.symbol}</p>
              </div>
            </div>
            <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
          </div>
          <div className="mb-3 flex flex-wrap gap-2">
            <Badge tone={selectedTiming.overdue ? 'danger' : STATUS_TONE[selected.status]}>{statusLabel(selected.status)}</Badge>
            <Badge tone={selectedTiming.overdue ? 'danger' : 'neutral'}>{selectedTiming.label}</Badge>
          </div>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div><dt className="text-ink-secondary">Review date</dt><dd className="font-medium text-ink">{selected.review_on}</dd></div>
            <div><dt className="text-ink-secondary">Follow-up</dt><dd className="font-medium text-ink">{selected.follow_up_on || '—'}</dd></div>
          </dl>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink">{selected.summary}</p>
          {can('trackers.update') && (
            <div className="mt-3">
              <Button variant="outline" onClick={() => openEdit(selected)}>Edit</Button>
            </div>
          )}
          {can('watchlist.read') && (
            <div className="mt-4 border-t border-line pt-3">
              <h3 className="text-sm font-semibold text-ink">Research notes</h3>
              {notes.isLoading ? (
                <Spinner label="Loading notes…" />
              ) : notes.isError ? (
                <ErrorState message={extractError(notes.error)} />
              ) : (notes.data?.results || []).length === 0 ? (
                <p className="mt-1 text-sm text-ink-secondary">No watchlist notes for this company.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {(notes.data?.results || []).map((note) => (
                    <li key={note.id} className="text-sm text-ink">
                      <span className="font-semibold">{note.title}</span> · {note.stance} · {note.note_date}
                      <p className="text-ink-secondary">{note.thesis}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Outlined>
      )}

      {confirmId !== null && (
        <ConfirmDialog
          title="Delete this tracker?"
          message="The tracker stays in the database as deleted and disappears from this list."
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
        <Modal title={modal.id ? 'Edit tracker' : 'New tracker'} onClose={() => setModal(null)}>
          <form onSubmit={submit} className="space-y-3">
            {error && <p className="rounded-xl border border-red-200 bg-negative-soft px-3 py-2 text-sm text-negative" role="alert">{error}</p>}
            <Select label="Company" value={form.symbol} onChange={(event) => setForm((current) => ({ ...current, symbol: event.target.value }))}>
              {COMPANIES.map((company) => (
                <option key={company.symbol} value={company.symbol}>{company.symbol} · {company.name}</option>
              ))}
            </Select>
            <Select label="Status" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
              {STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </Select>
            <Input label="Review date" type="date" value={form.review_on} required onChange={(event) => setForm((current) => ({ ...current, review_on: event.target.value }))} />
            <Input label="Follow-up date" type="date" value={form.follow_up_on} onChange={(event) => setForm((current) => ({ ...current, follow_up_on: event.target.value }))} />
            <label className="block text-sm">
              <span className="mb-1.5 block text-sm font-semibold text-ink">Summary</span>
              <textarea
                className="w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-sm text-ink hover:border-accent/40 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
                rows={4}
                value={form.summary}
                required
                onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))}
              />
            </label>
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

export default TrackersPage
