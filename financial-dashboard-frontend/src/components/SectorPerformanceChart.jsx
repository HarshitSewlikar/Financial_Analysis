import React from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Card } from './common/Ui'

const chartFrame = 'h-[240px] w-full min-w-0 md:h-[300px]'

export const MOCK_SECTOR_MESSAGE =
  'Sector visualization unavailable. Mock data has no defined measurement scale.'

export const UNKNOWN_SECTOR_MESSAGE =
  'Sector visualization unavailable. Data source and measurement units could not be verified.'

const shortName = (name) => {
  const text = String(name ?? '')
  return text.length > 18 ? `${text.slice(0, 16)}…` : text
}

const SectorPerformanceChart = ({ source, data }) => {
  if (source === 'mock') {
    return (
      <Card title="Sector performance">
        <p className="text-sm text-slate-600">{MOCK_SECTOR_MESSAGE}</p>
      </Card>
    )
  }

  if (source !== 'live') {
    return (
      <Card title="Sector performance">
        <p className="text-sm text-slate-600">{UNKNOWN_SECTOR_MESSAGE}</p>
      </Card>
    )
  }

  const rows = Array.isArray(data) ? data : []
  const numbers = rows.map((row) => Number(row.performance)).filter((value) => Number.isFinite(value))
  const min = numbers.length ? Math.min(0, ...numbers) : 0
  const max = numbers.length ? Math.max(0, ...numbers) : 0
  const pad = min === max ? 1 : 0

  return (
    <Card title="Sector return (%)">
      {rows.length === 0 ? (
        <p className="text-sm text-slate-600">No sector rows were returned.</p>
      ) : (
        <div className={chartFrame}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={rows}
              layout="vertical"
              margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                type="number"
                domain={[min - pad, max + pad]}
                tickFormatter={(value) => `${value}%`}
              />
              <YAxis
                type="category"
                dataKey="sector"
                width={120}
                tickFormatter={shortName}
                tick={{ fontSize: 12 }}
              />
              <ReferenceLine x={0} stroke="#94a3b8" />
              <Tooltip
                formatter={(value) => [`${value}%`, 'Return']}
                labelFormatter={(label) => String(label ?? '')}
              />
              <Bar dataKey="performance">
                {rows.map((row) => {
                  const value = Number(row.performance)
                  const fill = value > 0 ? '#065f46' : value < 0 ? '#991b1b' : '#64748b'
                  return <Cell key={row.sector} fill={fill} />
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  )
}

export default SectorPerformanceChart
