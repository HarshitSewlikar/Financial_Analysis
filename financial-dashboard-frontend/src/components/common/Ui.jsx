// src/components/common/Ui.jsx
import React from 'react'

export const Spinner = ({ label = 'Loading…' }) => (
  <div className="flex items-center gap-2 text-sm text-slate-500" role="status">
    <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700 motion-reduce:animate-none" />
    {label}
  </div>
)

export const ErrorState = ({ message }) => (
  <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
    {message}
  </div>
)

export const EmptyState = ({ message }) => (
  <div className="rounded-md border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
    {message}
  </div>
)

export const Card = ({ title, actions, children }) => (
  <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
    {(title || actions) && (
      <header className="mb-3 flex items-center justify-between">
        {title && <h2 className="text-base font-semibold text-slate-800">{title}</h2>}
        {actions}
      </header>
    )}
    {children}
  </section>
)

export const Button = ({ variant = 'primary', className = '', ...props }) => {
  const variants = {
    primary: 'bg-slate-900 text-white hover:bg-slate-700',
    secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50',
    danger: 'bg-red-600 text-white hover:bg-red-500',
  }
  return (
    <button
      className={`cursor-pointer rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-800 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    />
  )
}

export const Input = React.forwardRef(({ label, error, className = '', ...props }, ref) => (
  <label className="block text-sm">
    {label && <span className="mb-1 block font-medium text-slate-700">{label}</span>}
    <input
      ref={ref}
      className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:border-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-800/30 ${className}`}
      {...props}
    />
    {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
  </label>
))
Input.displayName = 'Input'

export const Select = React.forwardRef(({ label, error, children, className = '', ...props }, ref) => (
  <label className="block text-sm">
    {label && <span className="mb-1 block font-medium text-slate-700">{label}</span>}
    <select
      ref={ref}
      className={`w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:border-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-800/30 ${className}`}
      {...props}
    >
      {children}
    </select>
    {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
  </label>
))
Select.displayName = 'Select'

export const Modal = ({ title, onClose, children, wide = false, width }) => {
  const dialogRef = React.useRef(null)
  const onCloseRef = React.useRef(onClose)
  onCloseRef.current = onClose

  React.useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    dialogRef.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        tabIndex={-1}
        className={`max-h-[85vh] w-full overflow-y-auto rounded-lg bg-white p-5 shadow-xl focus-visible:outline-none ${
          width || (wide ? 'max-w-2xl' : 'max-w-lg')
        }`}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 id="dialog-title" className="text-lg font-semibold text-slate-900">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-800"
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
    <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
      <span>
        Page {page} of {totalPages} · {total ?? 0} records
      </span>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <Button
          variant="secondary"
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
          <tr className="border-b border-slate-200 text-left text-slate-500">
            {columns.map((col) => (
              <th key={col.key || col.header} scope="col" className="px-3 py-2 font-medium">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id ?? index} className="border-b border-slate-100 hover:bg-slate-50">
              {columns.map((col) => (
                <td key={col.key || col.header} className="px-3 py-2 align-middle">
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
