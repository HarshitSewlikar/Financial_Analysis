export const liveQuote = (result) => {
  if (!result || result.source !== 'live' || !Array.isArray(result.data) || result.data.length === 0) return null
  const last = Number(result.data[result.data.length - 1].close)
  const previousBar = result.data.length > 1 ? result.data[result.data.length - 2] : null
  const previous = previousBar == null ? null : Number(previousBar.close)
  if (!Number.isFinite(last)) return null
  const change = previous != null && Number.isFinite(previous) ? last - previous : null
  const changePct = change != null && previous ? (change / previous) * 100 : null
  return { close: last, change, changePct, bars: result.data }
}

export const formatPrice = (value) =>
  Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const formatChange = (value) => `${value >= 0 ? '+' : ''}${Number(value).toFixed(2)}%`

export const reviewTiming = (reviewOn, status, today = new Date()) => {
  if (status === 'complete') return { label: 'Complete', overdue: false }
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const review = new Date(`${reviewOn}T00:00:00`)
  const days = Math.round((review - start) / 86400000)
  if (days < 0) return { label: `${Math.abs(days)}d overdue`, overdue: true }
  if (days === 0) return { label: 'Due today', overdue: false }
  return { label: `${days}d left`, overdue: false }
}
