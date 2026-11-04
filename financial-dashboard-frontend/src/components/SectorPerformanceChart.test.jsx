import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import SectorPerformanceChart from './SectorPerformanceChart'

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  CartesianGrid: () => null,
  BarChart: ({ data, children }) => (
    <div data-testid="sector-bars" data-values={data.map((row) => row.performance).join(',')}>
      {children}
    </div>
  ),
  Bar: ({ children }) => <div>{children}</div>,
  Cell: ({ fill }) => <span data-testid="sector-cell" data-fill={fill} />,
  XAxis: ({ domain, tickFormatter }) => (
    <div data-testid="sector-axis" data-domain={domain.join(',')}>
      {tickFormatter(0)}
    </div>
  ),
  YAxis: ({ tickFormatter }) => <div>{tickFormatter('Information Technology')}</div>,
  ReferenceLine: ({ x }) => <div data-testid="sector-zero">{String(x)}</div>,
  Tooltip: ({ formatter, labelFormatter }) => (
    <>
      <div data-testid="sector-tooltip">{formatter(-0.5)[0]}</div>
      <div>{labelFormatter('Information Technology')}</div>
    </>
  ),
}))

const rows = [
  { sector: 'Energy', performance: 1.25 },
  { sector: 'Information Technology', performance: -0.5 },
  { sector: 'Utilities', performance: 0 },
]

describe('SectorPerformanceChart', () => {
  it('plots explicit live values around zero, including a zero return', () => {
    render(<SectorPerformanceChart source="live" data={rows} />)

    expect(screen.getByText('Sector return (%)')).toBeInTheDocument()
    expect(screen.getByTestId('sector-bars')).toHaveAttribute('data-values', '1.25,-0.5,0')
    expect(screen.getByTestId('sector-axis')).toHaveAttribute('data-domain', '-0.5,1.25')
    expect(screen.getByTestId('sector-axis')).toHaveTextContent('0%')
    expect(screen.getByTestId('sector-zero')).toHaveTextContent('0')
    expect(screen.getByText('-0.5%')).toBeInTheDocument()
    expect(screen.getByText('Information Technology')).toBeInTheDocument()
    expect(screen.getAllByTestId('sector-cell').map((cell) => cell.getAttribute('data-fill'))).toEqual([
      '#065f46',
      '#991b1b',
      '#64748b',
    ])
  })

  it('does not plot mock values as a percentage chart', () => {
    render(<SectorPerformanceChart source="mock" data={rows} />)

    expect(screen.getByText(/Mock data has no defined measurement scale/)).toBeInTheDocument()
    expect(screen.queryByText('Sector return (%)')).not.toBeInTheDocument()
    expect(screen.queryByTestId('sector-bars')).not.toBeInTheDocument()
    expect(screen.queryByText('1.25')).not.toBeInTheDocument()
  })

  it('does not plot an unknown source as a percentage chart', () => {
    const { rerender } = render(<SectorPerformanceChart source="unknown" data={rows} />)

    expect(screen.getByText(/Data source and measurement units could not be verified/)).toBeInTheDocument()
    expect(screen.queryByText('Sector return (%)')).not.toBeInTheDocument()
    expect(screen.queryByTestId('sector-bars')).not.toBeInTheDocument()

    rerender(<SectorPerformanceChart data={rows} />)
    expect(screen.getByText(/Data source and measurement units could not be verified/)).toBeInTheDocument()
    expect(screen.queryByTestId('sector-bars')).not.toBeInTheDocument()
  })
})
