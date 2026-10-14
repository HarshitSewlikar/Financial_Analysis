// src/components/common/Ui.jsx
import React from 'react'

export const Spinner = ({ label = 'Loading…' }) => (
  <div className="flex items-center gap-2 text-slate-500 text-sm">
    <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
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
      className={`rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    />
  )
}

export const Input = React.forwardRef(({ label, error, className = '', ...props }, ref) => (
  <label className="block text-sm">
    {label && <span className="mb-1 block font-medium text-slate-700">{label}</span>}
    <input
      ref={ref}
      className={`w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-slate-500 ${className}`}
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
      className={`w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-slate-500 ${className}`}
      {...props}
    >
      {children}
    </select>
    {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
  </label>
))
Select.displayName = 'Select'

export const Modal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
    <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">{title}</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="Close">
          ✕
        </button>
      </div>
      {children}
    </div>
  </div>
)

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
              <th key={col.key} className="px-3 py-2 font-medium">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id ?? index} className="border-b border-slate-100 hover:bg-slate-50">
              {columns.map((col) => (
                <td key={col.key} className="px-3 py-2 align-middle">
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
