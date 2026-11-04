import { describe, expect, it, vi } from 'vitest'

import { http } from './http'
import { classifySectorSource, getDailyStock, getSectors } from './endpoints'

const sectorRows = [
  { sector: 'Energy', performance: 1.25 },
  { sector: 'Financials', performance: -0.5 },
  { sector: 'Utilities', performance: 0 },
]

describe('classifySectorSource', () => {
  it('accepts an explicit live source', () => {
    expect(classifySectorSource('live')).toBe('live')
    expect(classifySectorSource(' LIVE ')).toBe('live')
  })

  it('accepts an explicit mock source', () => {
    expect(classifySectorSource('mock')).toBe('mock')
    expect(classifySectorSource('Mock')).toBe('mock')
  })

  it('treats a missing header as unknown', () => {
    expect(classifySectorSource(undefined)).toBe('unknown')
    expect(classifySectorSource(null)).toBe('unknown')
    expect(classifySectorSource('')).toBe('unknown')
  })

  it('treats an invalid header as unknown', () => {
    expect(classifySectorSource('bogus')).toBe('unknown')
    expect(classifySectorSource('live-ish')).toBe('unknown')
  })
})

describe('getSectors', () => {
  it('keeps the payload and classifies the source header', async () => {
    const get = vi.spyOn(http, 'get')

    get.mockResolvedValueOnce({ data: sectorRows, headers: { 'x-data-source': 'live' } })
    await expect(getSectors()).resolves.toEqual({ data: sectorRows, source: 'live' })

    get.mockResolvedValueOnce({ data: sectorRows, headers: { 'x-data-source': 'mock' } })
    await expect(getSectors()).resolves.toEqual({ data: sectorRows, source: 'mock' })

    get.mockResolvedValueOnce({ data: sectorRows, headers: {} })
    await expect(getSectors()).resolves.toEqual({ data: sectorRows, source: 'unknown' })

    get.mockResolvedValueOnce({ data: sectorRows, headers: { 'x-data-source': 'nope' } })
    await expect(getSectors()).resolves.toEqual({ data: sectorRows, source: 'unknown' })

    get.mockRestore()
  })

  it('leaves the other market helper default unchanged', async () => {
    const get = vi.spyOn(http, 'get').mockResolvedValueOnce({ data: [], headers: {} })
    await expect(getDailyStock('IBM')).resolves.toMatchObject({ source: 'live' })
    get.mockRestore()
  })
})
