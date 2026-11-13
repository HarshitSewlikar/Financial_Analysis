import React, { useState } from 'react'

import { Button, Input, Modal } from '../common/Ui'

export const Outlined = ({ children, tone = 'plain', className = '' }) => (
  <section className={`admin-panel admin-panel-${tone} ${className}`}>{children}</section>
)

const SearchGlyph = () => (
  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <circle cx="8.5" cy="8.5" r="5.25" />
    <path d="M12.5 12.5 17 17" strokeLinecap="round" />
  </svg>
)

export const SearchField = ({ label, ...props }) => (
  <div className="relative">
    <Input label={label} className="pl-9" {...props} />
    <span className="pointer-events-none absolute bottom-[0.85rem] left-3 text-ink-muted">
      <SearchGlyph />
    </span>
  </div>
)

const ART = {
  key: 'M8 15a5 5 0 1 1 4.6-3H20v3h-2v2h-2v-2h-3.4A5 5 0 0 1 8 15Zm0-3.2a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4Z',
  chart: 'M4 19V5M4 19h16M8 15l3-3 2.5 2L18 8',
}

const SCENES = {
  clipboard: (
    <svg viewBox="0 0 148 96" className="h-full w-full">
      <g transform="translate(104 16) rotate(32)">
        <rect x="0" y="0" width="7" height="34" rx="2" fill="#60a5fa" />
        <path d="M0 34h7l-3.5 8z" fill="#2563eb" />
      </g>
      <g transform="translate(22 6) rotate(-8)">
        <rect x="0" y="10" width="68" height="78" rx="10" fill="#dbeafe" />
        <rect x="7" y="18" width="54" height="62" rx="5" fill="#fff" />
        <rect x="23" y="4" width="22" height="12" rx="4" fill="#93c5fd" />
        <rect x="16" y="32" width="9" height="9" rx="2" fill="#bfdbfe" />
        <rect x="30" y="34.5" width="22" height="3.5" rx="1.5" fill="#cbd5e1" />
        <rect x="16" y="47" width="9" height="9" rx="2" fill="#bfdbfe" />
        <rect x="30" y="49.5" width="18" height="3.5" rx="1.5" fill="#cbd5e1" />
        <rect x="16" y="62" width="9" height="9" rx="2" fill="#93c5fd" />
        <rect x="30" y="64.5" width="20" height="3.5" rx="1.5" fill="#cbd5e1" />
      </g>
    </svg>
  ),
  people: (
    <svg viewBox="0 0 148 96" className="h-full w-full">
      <g transform="translate(58 8)">
        <circle cx="30" cy="20" r="13" fill="#bfdbfe" />
        <path d="M6 62c2-18 12-26 24-26s22 8 24 26" fill="#dbeafe" />
      </g>
      <g transform="translate(18 14)">
        <circle cx="28" cy="18" r="15" fill="#60a5fa" />
        <path d="M2 64c3-20 14-28 26-28s23 8 26 28" fill="#93c5fd" />
      </g>
    </svg>
  ),
  layers: (
    <svg viewBox="0 0 148 96" className="h-full w-full">
      <g transform="translate(22 12)">
        <rect x="6" y="46" width="96" height="24" rx="7" fill="#dbeafe" transform="rotate(-7 54 58)" />
        <rect x="10" y="28" width="92" height="24" rx="7" fill="#bfdbfe" />
        <rect x="14" y="10" width="88" height="24" rx="7" fill="#93c5fd" />
        <rect x="28" y="19" width="40" height="4" rx="2" fill="#fff" opacity="0.85" />
      </g>
    </svg>
  ),
  document: (
    <svg viewBox="0 0 148 96" className="h-full w-full">
      <rect x="24" y="8" width="64" height="78" rx="8" fill="#dbeafe" />
      <rect x="34" y="22" width="38" height="4" rx="2" fill="#fff" />
      <rect x="34" y="32" width="30" height="4" rx="2" fill="#fff" />
      <rect x="34" y="42" width="34" height="4" rx="2" fill="#fff" />
      <rect x="34" y="52" width="22" height="4" rx="2" fill="#fff" />
      <circle cx="92" cy="58" r="16" fill="#eff6ff" stroke="#3b82f6" strokeWidth="4" />
      <circle cx="92" cy="58" r="7" fill="#dbeafe" />
      <path d="M104 70l12 14" stroke="#3b82f6" strokeWidth="4" strokeLinecap="round" />
    </svg>
  ),
}

export const PageArt = ({ name }) => {
  const scene = SCENES[name]
  if (scene) {
    return (
      <span className="hidden h-[4.75rem] w-[7.75rem] shrink-0 sm:block" aria-hidden="true">
        {scene}
      </span>
    )
  }
  return (
    <span
      className="hidden h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-info-soft text-accent sm:flex"
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d={ART[name] || ART.chart} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

export const AdminPage = ({ title, description, actions, art, children, className = '' }) => (
  <div className={`admin-page space-y-3 ${className}`}>
    <Outlined tone="hero">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 max-w-2xl flex-1">
          <h1 className="text-[1.7rem] font-semibold tracking-tight text-ink">{title}</h1>
          {description && <p className="mt-1 text-sm leading-6 text-ink-secondary">{description}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          {art}
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      </header>
    </Outlined>
    {children}
  </div>
)

const BADGE_TONES = {
  neutral: 'bg-[#eef2f6] text-[#64748b]',
  success: 'bg-[#e7f8ee] text-[#15803d]',
  danger: 'bg-[#fde8ea] text-[#e11d48]',
  warning: 'bg-[#fff1e4] text-[#c2410c]',
  warm: 'bg-[#fff6d8] text-[#b45309]',
  info: 'bg-[#e7f0ff] text-[#1d4ed8]',
}

export const Badge = ({ tone = 'neutral', children }) => (
  <span
    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold leading-4 ${BADGE_TONES[tone] || BADGE_TONES.neutral}`}
  >
    {children}
  </span>
)

export const ActiveBadge = ({ active }) => (
  <Badge tone={active ? 'success' : 'danger'}>{active ? 'Active' : 'Inactive'}</Badge>
)

export const FormActions = ({ onCancel, pending, submitLabel = 'Save' }) => (
  <div className="flex justify-end gap-2 pt-1">
    <Button variant="outline" type="button" onClick={onCancel}>
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
}) => {
  const descriptionId = React.useId()
  return (
    <Modal title={title} onClose={onClose} describedBy={descriptionId}>
      <p id={descriptionId} className="text-sm leading-6 text-ink-secondary">
        {message}
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" type="button" data-dialog-initial onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="danger"
          type="button"
          onClick={onConfirm}
          disabled={pending}
          aria-busy={pending}
        >
          {pending ? 'Working…' : confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}

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
