import { describe, expect, it } from 'vitest'

import { filterByRange, isAscendingByDate, prepareLineData } from './chartData'

const makeSeries = (count, startDaysAgo = count) => {
  const base = new Date()
  const data = []
  for (let i = 0; i < count; i += 1) {
    const date = new Date(base)
    date.setDate(base.getDate() - (startDaysAgo - i))
    data.push({ date: date.toISOString().slice(0, 10), close: 100 + i })
  }
  return data
}

describe('prepareLineData', () => {
  it('returns all points and never slices the series (regression)', () => {
    const series = makeSeries(120)
    const result = prepareLineData(series)
    expect(result).toHaveLength(120)
    expect(result[0]).toBe(series[0])
    expect(result[result.length - 1]).toBe(series[series.length - 1])
  })

  it('preserves chronological (ascending) order (regression)', () => {
    const series = makeSeries(120)
    const result = prepareLineData(series)
    expect(isAscendingByDate(result)).toBe(true)
    expect(result[0].close).toBe(100)
    expect(result[result.length - 1].close).toBe(219)
  })

  it('returns an empty array for non-array input', () => {
    expect(prepareLineData(undefined)).toEqual([])
  })
})

describe('filterByRange', () => {
  it('filters to the trailing N months', () => {
    const series = makeSeries(400, 400) // ~13 months of daily points
    const filtered = filterByRange(series, 1)
    expect(filtered.length).toBeGreaterThan(0)
    expect(filtered.length).toBeLessThan(series.length)
    expect(isAscendingByDate(filtered)).toBe(true)
  })

  it('returns all points when months is null (all time)', () => {
    const series = makeSeries(120)
    expect(filterByRange(series, null)).toHaveLength(120)
  })

  it('handles empty input', () => {
    expect(filterByRange([], 3)).toEqual([])
    expect(filterByRange(undefined, 3)).toEqual([])
  })
})

describe('isAscendingByDate', () => {
  it('detects a reversed series', () => {
    const series = makeSeries(5)
    expect(isAscendingByDate([...series].reverse())).toBe(false)
  })

  it('treats non-arrays as ascending (vacuously)', () => {
    expect(isAscendingByDate(undefined)).toBe(true)
  })
})
