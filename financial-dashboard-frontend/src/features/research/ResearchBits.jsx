import React from 'react'
import { Line, LineChart } from 'recharts'

import { formatChange, formatPrice } from './quote'

export const TickerAvatar = ({ symbol }) => (
  <span
    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-info-soft text-xs font-semibold tracking-wide text-accent"
    aria-hidden="true"
  >
    {String(symbol || '').slice(0, 4)}
  </span>
)

export const Sparkline = ({ bars }) => (
  <LineChart width={96} height={32} data={bars}>
    <Line type="monotone" dataKey="close" stroke="#3B82F6" strokeWidth={1.5} dot={false} isAnimationActive={false} />
  </LineChart>
)

export const PriceCell = ({ quote }) => {
  if (!quote) return <span className="text-ink-muted">Unavailable</span>
  const tone = quote.changePct == null ? 'text-ink' : quote.changePct >= 0 ? 'text-positive' : 'text-negative'
  return (
    <div>
      <div className="font-semibold tabular-nums text-ink">{formatPrice(quote.close)}</div>
      {quote.changePct != null && <div className={`text-xs font-semibold tabular-nums ${tone}`}>{formatChange(quote.changePct)}</div>}
    </div>
  )
}

export const Stat = ({ label, value }) => (
  <div className="min-w-[7rem] flex-1 rounded-xl border border-line bg-surface px-3 py-2">
    <div className="text-xs font-medium text-ink-secondary">{label}</div>
    <div className="mt-1 text-lg font-semibold tabular-nums text-ink">{value}</div>
  </div>
)
