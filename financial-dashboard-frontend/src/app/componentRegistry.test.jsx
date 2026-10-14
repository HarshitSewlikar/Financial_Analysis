import { describe, expect, it } from 'vitest'

import { flattenMenus } from './componentRegistry'

describe('flattenMenus', () => {
  it('flattens nested children depth-first preserving order', () => {
    const menus = [
      { code: 'a', path: '/a' },
      { code: 'b', path: '/b', children: [{ code: 'b1', path: '/b/1' }] },
      { code: 'c', path: '/c' },
    ]
    expect(flattenMenus(menus).map((m) => m.code)).toEqual(['a', 'b', 'b1', 'c'])
  })

  it('handles an empty menu tree', () => {
    expect(flattenMenus()).toEqual([])
    expect(flattenMenus(null)).toEqual([])
  })
})
