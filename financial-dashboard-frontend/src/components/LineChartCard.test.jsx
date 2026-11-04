import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import LineChartCard from './LineChartCard'

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  CartesianGrid: () => null,
  LineChart: ({ data, children }) => (
    <div data-testid="close-series" data-count={data.length}>
      {children}
    </div>
  ),
  Line: (props) => <div data-testid="close-line" data-dot={String(props.dot)} data-stroke={props.stroke} />,
  XAxis: ({ minTickGap }) => <div data-testid="close-x" data-gap={minTickGap} />,
  YAxis: ({ label }) => <div data-testid="close-y">{label.value}</div>,
  Tooltip: ({ formatter }) => <div data-testid="close-tooltip">{formatter(294.6).join('|')}</div>,
  Legend: () => <div>Legend</div>,
}))

describe('LineChartCard', () => {
  it('labels close without a currency sign and keeps every point', () => {
    const data = [
      { date: '2024-01-02', close: 100 },
      { date: '2026-11-04', close: 294.6 },
    ]
    render(<LineChartCard data={data} title="IBM Daily Close (All Time)" dataKey="close" tooltipLabel="Close" />)

    expect(screen.getByTestId('close-series')).toHaveAttribute('data-count', '2')
    expect(screen.getByTestId('close-y')).toHaveTextContent('Close')
    expect(screen.getByTestId('close-tooltip')).toHaveTextContent('294.60|Close')
    expect(screen.getByTestId('close-tooltip').textContent).not.toContain('$')
    expect(screen.getByTestId('close-line')).toHaveAttribute('data-dot', 'false')
    expect(screen.getByTestId('close-line')).toHaveAttribute('data-stroke', '#4F46E5')
    expect(screen.getByTestId('close-x')).toHaveAttribute('data-gap', '32')
    expect(screen.queryByText('Legend')).not.toBeInTheDocument()
  })
})
