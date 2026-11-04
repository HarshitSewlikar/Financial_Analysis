import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DataTable } from './Ui'

const columns = [
  { header: 'Name', key: 'name' },
  {
    header: 'Count',
    key: 'count',
    className: 'text-right tabular-nums',
    render: (row) => row.count.toLocaleString(),
  },
]

describe('DataTable column class', () => {
  it('applies an optional class to the header and cells', () => {
    render(<DataTable columns={columns} rows={[{ id: 1, name: 'Ada', count: 1200 }]} />)

    const countHeader = screen.getByRole('columnheader', { name: 'Count' })
    expect(countHeader).toHaveAttribute('scope', 'col')
    expect(countHeader).toHaveClass('text-right', 'tabular-nums', 'px-3', 'py-2', 'font-medium')

    const countCell = screen.getByText('1,200')
    expect(countCell).toHaveClass('text-right', 'tabular-nums', 'px-3', 'py-2', 'align-middle')
  })

  it('leaves columns without a class on the existing styles', () => {
    render(<DataTable columns={columns} rows={[{ id: 1, name: 'Ada', count: 2 }]} />)

    const nameHeader = screen.getByRole('columnheader', { name: 'Name' })
    expect(nameHeader).toHaveAttribute('scope', 'col')
    expect(nameHeader).toHaveClass('px-3', 'py-2', 'font-medium')
    expect(nameHeader).not.toHaveClass('text-right')

    const nameCell = screen.getByText('Ada')
    expect(nameCell).toHaveClass('px-3', 'py-2', 'align-middle')
    expect(nameCell).not.toHaveClass('text-right')
  })

  it('keeps the empty state when there are no rows', () => {
    render(<DataTable columns={columns} rows={[]} emptyMessage="No records." />)

    expect(screen.getByText('No records.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader')).not.toBeInTheDocument()
  })
})
