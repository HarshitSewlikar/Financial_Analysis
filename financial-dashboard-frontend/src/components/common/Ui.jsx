// src/components/common/Ui.jsx
import React from 'react'

export const Spinner = ({ label = 'Loading…' }) => (
  <div className="flex items-center gap-2 text-sm text-ink-secondary" role="status">
    <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-soft border-t-accent motion-reduce:animate-none" />
    {label}
  </div>
)

export const ErrorState = ({ message }) => (
  <div className="rounded-xl border border-red-200 bg-negative-soft px-4 py-3 text-sm font-medium text-negative" role="alert">
    {message}
  </div>
)

export const EmptyState = ({ message }) => (
  <div className="rounded-xl border border-dashed border-accent/30 bg-indigo-soft px-4 py-8 text-center text-sm text-ink-secondary">
    {message}
  </div>
)

export const Card = ({ title, actions, children, tone = 'default' }) => (
  <section
    className={`rounded-[14px] border p-5 shadow-[0_1px_2px_rgba(23,23,47,0.05),0_16px_36px_-24px_rgba(79,70,229,0.45)] ${
      tone === 'tint' ? 'border-accent/15 bg-indigo-soft' : 'border-line bg-surface'
    }`}
  >
    {(title || actions) && (
      <header className="mb-4 flex items-center justify-between gap-3">
        {title && <h2 className="text-base font-semibold tracking-tight text-ink">{title}</h2>}
        {actions}
      </header>
    )}
    {children}
  </section>
)

export const Button = ({ variant = 'primary', className = '', ...props }) => {
  const variants = {
    primary: 'btn-primary text-white focus-visible:ring-accent',
    secondary: 'border border-accent/20 bg-indigo-soft text-accent hover:bg-violet-soft focus-visible:ring-accent',
    outline: 'border border-line bg-surface text-ink hover:border-accent/40 hover:bg-indigo-soft focus-visible:ring-accent',
    ghost: 'bg-transparent text-ink-secondary hover:bg-indigo-soft hover:text-accent focus-visible:ring-accent',
    danger: 'bg-negative text-white shadow-[0_10px_22px_-14px_rgba(185,28,28,0.9)] hover:bg-red-800 focus-visible:ring-negative',
  }
  return (
    <button
      className={`inline-flex min-h-11 cursor-pointer items-center justify-center rounded-[10px] px-4 text-sm font-semibold transition-[background,box-shadow,filter] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    />
  )
}

export const Input = React.forwardRef(({ label, error, className = '', ...props }, ref) => (
  <label className="block text-sm">
    {label && <span className="mb-1.5 block text-sm font-semibold text-ink">{label}</span>}
    <input
      ref={ref}
      className={`min-h-11 w-full rounded-[10px] border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-muted hover:border-accent/40 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 disabled:bg-surface-muted ${className}`}
      {...props}
    />
    {error && <span className="mt-1 block text-xs text-negative">{error}</span>}
  </label>
))
Input.displayName = 'Input'

export const Select = React.forwardRef(({ label, error, children, className = '', ...props }, ref) => (
  <label className="block text-sm">
    {label && <span className="mb-1.5 block text-sm font-semibold text-ink">{label}</span>}
    <select
      ref={ref}
      className={`min-h-11 w-full rounded-[10px] border border-line bg-surface px-3 text-sm text-ink hover:border-accent/40 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 disabled:bg-surface-muted ${className}`}
      {...props}
    >
      {children}
    </select>
    {error && <span className="mt-1 block text-xs text-negative">{error}</span>}
  </label>
))
Select.displayName = 'Select'

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

const isFocusable = (element) => {
  if (element.hasAttribute('disabled') || element.getAttribute('aria-hidden') === 'true') return false
  if (element.closest('[hidden]')) return false
  const style = window.getComputedStyle(element)
  return style.display !== 'none' && style.visibility !== 'hidden'
}

const focusableInside = (root) =>
  [...root.querySelectorAll(focusableSelector)].filter(isFocusable)

const rememberBackground = (overlay) => {
  const saved = []
  let node = overlay
  while (node && node.parentElement && node !== document.body) {
    for (const sibling of node.parentElement.children) {
      if (sibling === node) continue
      saved.push({
        element: sibling,
        inert: sibling.hasAttribute('inert'),
        ariaHidden: sibling.getAttribute('aria-hidden'),
      })
      sibling.setAttribute('inert', '')
      sibling.setAttribute('aria-hidden', 'true')
    }
    node = node.parentElement
  }
  return saved
}

export const Modal = ({ title, onClose, children, wide = false, width, describedBy }) => {
  const titleId = React.useId()
  const overlayRef = React.useRef(null)
  const dialogRef = React.useRef(null)
  const onCloseRef = React.useRef(onClose)
  const openerRef = React.useRef(null)
  onCloseRef.current = onClose

  React.useEffect(() => {
    openerRef.current = document.activeElement
    const overlay = overlayRef.current
    const dialog = dialogRef.current
    const saved = overlay ? rememberBackground(overlay) : []
    const previous = {
      body: document.body.style.overflow,
      root: document.documentElement.style.overflow,
      x: window.scrollX,
      y: window.scrollY,
    }
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'

    const initial = dialog?.querySelector('[data-dialog-initial]')
    if (initial && isFocusable(initial)) initial.focus()
    else dialog?.focus()

    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !dialog) return
      const items = focusableInside(dialog)
      if (items.length === 0) {
        event.preventDefault()
        event.stopPropagation()
        dialog.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      const inside = active !== dialog && dialog.contains(active)
      if (event.shiftKey && (!inside || active === first)) {
        event.preventDefault()
        event.stopPropagation()
        last.focus()
      } else if (!event.shiftKey && (!inside || active === last)) {
        event.preventDefault()
        event.stopPropagation()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey, true)

    return () => {
      document.removeEventListener('keydown', onKey, true)
      saved.forEach(({ element, inert, ariaHidden }) => {
        if (inert) element.setAttribute('inert', '')
        else element.removeAttribute('inert')
        if (ariaHidden === null) element.removeAttribute('aria-hidden')
        else element.setAttribute('aria-hidden', ariaHidden)
      })
      document.body.style.overflow = previous.body
      document.documentElement.style.overflow = previous.root
      window.scrollTo(previous.x, previous.y)
      const opener = openerRef.current
      if (opener instanceof HTMLElement && opener.isConnected) {
        opener.focus()
        return
      }
      document.getElementById('current-page')?.focus()
    }
  }, [])

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={describedBy}
        tabIndex={-1}
        className={`max-h-[85vh] w-full overflow-y-auto rounded-[14px] border border-line bg-surface p-5 shadow-[0_24px_60px_-24px_rgba(23,23,47,0.45)] focus-visible:outline-none ${
          width || (wide ? 'max-w-2xl' : 'max-w-lg')
        }`}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 id={titleId} className="text-lg font-semibold text-ink">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-md p-2 text-ink-muted hover:bg-surface-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Close"
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
              <path d="M6.2 5.2a.75.75 0 0 0-1 1.06L8.94 10l-3.74 3.74a.75.75 0 1 0 1.06 1.06L10 11.06l3.74 3.74a.75.75 0 1 0 1.06-1.06L11.06 10l3.74-3.74a.75.75 0 1 0-1.06-1.06L10 8.94 6.2 5.2Z" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export const Pagination = ({ page, pageSize, total, onPageChange }) => {
  const totalPages = Math.max(1, Math.ceil((total || 0) / (pageSize || 25)))
  return (
    <div className="mt-3 flex items-center justify-between text-sm text-ink-secondary">
      <span>
        Page {page} of {totalPages} · {total ?? 0} records
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  )
}

export const DataTable = ({ columns, rows, emptyMessage = 'No records.' }) => {
  if (!rows || rows.length === 0) return <EmptyState message={emptyMessage} />
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-accent/40 bg-info-soft text-left text-ink">
            {columns.map((col) => (
              <th
                key={col.key || col.header}
                scope="col"
                className={['px-3 py-2 font-medium', col.className].filter(Boolean).join(' ')}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id ?? index} className="border-b border-line hover:bg-violet-soft">
              {columns.map((col) => (
                <td
                  key={col.key || col.header}
                  className={['px-3 py-2 align-middle', col.className].filter(Boolean).join(' ')}
                >
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
