import React, { useState } from 'react'

import { Button, Input, Modal } from '../common/Ui'

export const AdminPage = ({ title, description, actions, children }) => (
  <div className="admin-page space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="max-w-2xl">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
    {children}
  </div>
)

const BADGE_TONES = {
  neutral: 'bg-slate-100 text-slate-700',
  success: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200',
  danger: 'bg-red-50 text-red-800 ring-1 ring-red-200',
  warning: 'bg-amber-50 text-amber-900 ring-1 ring-amber-200',
}

export const Badge = ({ tone = 'neutral', children }) => (
  <span
    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_TONES[tone]}`}
  >
    {children}
  </span>
)

export const ActiveBadge = ({ active }) => (
  <Badge tone={active ? 'success' : 'neutral'}>{active ? 'Active' : 'Inactive'}</Badge>
)

export const FormActions = ({ onCancel, pending, submitLabel = 'Save' }) => (
  <div className="flex justify-end gap-2 pt-1">
    <Button variant="secondary" type="button" onClick={onCancel}>
      Cancel
    </Button>
    <Button type="submit" disabled={pending} aria-busy={pending}>
      {pending ? 'Saving…' : submitLabel}
    </Button>
  </div>
)

export const ConfirmDialog = ({
  title,
  message,
  confirmLabel = 'Confirm',
  pending = false,
  onConfirm,
  onClose,
}) => (
  <Modal title={title} onClose={onClose}>
    <p className="text-sm leading-6 text-slate-600">{message}</p>
    <div className="mt-4 flex justify-end gap-2">
      <Button variant="secondary" type="button" onClick={onClose}>
        Cancel
      </Button>
      <Button variant="danger" type="button" onClick={onConfirm} disabled={pending} aria-busy={pending}>
        {pending ? 'Working…' : confirmLabel}
      </Button>
    </div>
  </Modal>
)

export const groupByResource = (items) => {
  const groups = new Map()
  items.forEach((item) => {
    const resource = item.resource || 'all'
    if (!groups.has(resource)) groups.set(resource, [])
    groups.get(resource).push(item)
  })
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
}

export const FilterableChecklist = ({
  items,
  isChecked,
  onToggle,
  idOf,
  labelOf,
  detailOf,
  searchLabel = 'Filter this list',
}) => {
  const [query, setQuery] = useState('')
  const needle = query.trim().toLowerCase()
  const visible = needle
    ? items.filter((item) => {
        const label = String(labelOf(item)).toLowerCase()
        const detail = String(detailOf ? detailOf(item) : '').toLowerCase()
        return label.includes(needle) || detail.includes(needle)
      })
    : items
  const groups = groupByResource(visible)
  const showGroups = groups.some(([name]) => name !== 'all')

  return (
    <div className="space-y-3">
      <Input
        label={searchLabel}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Type a name, such as todos"
      />
      {groups.length === 0 ? (
        <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-600">
          Nothing matches “{query}”. Try a shorter word, such as the resource name.
        </p>
      ) : (
        <div className="max-h-80 space-y-4 overflow-y-auto pr-1">
          {groups.map(([resource, group]) => (
            <fieldset key={resource} className="space-y-1">
              {showGroups && (
                <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {resource}
                </legend>
              )}
              {group.map((item) => {
                const label = labelOf(item)
                const detail = detailOf ? detailOf(item) : ''
                return (
                  <label
                    key={idOf ? idOf(item) : label}
                    className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={isChecked(item)}
                      onChange={() => onToggle(item)}
                    />
                    <span>
                      <span className="font-medium text-slate-800">{label}</span>
                      {detail && <span className="mt-0.5 block text-xs text-slate-500">{detail}</span>}
                    </span>
                  </label>
                )
              })}
            </fieldset>
          ))}
        </div>
      )}
    </div>
  )
}
