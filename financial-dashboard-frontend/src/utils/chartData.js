// Pure helpers for preparing chart data. Covered by unit tests.

// Filter a daily series (ascending by date) down to the trailing N months.
// `months` of null/0 means "all time" (no filtering).
export const filterByRange = (data, months) => {
  if (!Array.isArray(data) || data.length === 0 || !months) return data || []
  const start = new Date()
  start.setMonth(start.getMonth() - months)
  return data.filter((item) => new Date(item.date) >= start)
}

// Prepare data for the line chart. The server already returns an ascending,
// range-filtered series, so this must NOT re-slice or reverse it (a previous
// bug cut the series to the last 90 points and reversed the X axis).
export const prepareLineData = (data) => (Array.isArray(data) ? data : [])

export const isAscendingByDate = (data) => {
  if (!Array.isArray(data)) return true
  for (let i = 1; i < data.length; i += 1) {
    if (new Date(data[i].date) < new Date(data[i - 1].date)) return false
  }
  return true
}
