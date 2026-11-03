import { describe, expect, it } from 'vitest'

import { extractError } from './http'

describe('extractError', () => {
  it('reads a string error.detail', () => {
    const error = { response: { data: { error: { detail: 'Nope.' } } } }
    expect(extractError(error)).toBe('Nope.')
  })

  it('joins field validation errors with the field name', () => {
    const error = {
      response: {
        data: { error: { detail: { username: ['required'], password: ['too short'] } } },
      },
    }
    const message = extractError(error)
    expect(message).toContain('username: required')
    expect(message).toContain('password: too short')
  })

  it('reads a top-level detail', () => {
    expect(extractError({ response: { data: { detail: 'Forbidden' } } })).toBe('Forbidden')
  })

  it('falls back to the error message', () => {
    expect(extractError({ message: 'Network Error' })).toBe('Network Error')
  })

  it('has a final fallback', () => {
    expect(extractError({})).toBe('Request failed')
  })
})
