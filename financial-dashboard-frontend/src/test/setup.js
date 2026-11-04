import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, vi } from 'vitest'

let scrollToSpy

beforeEach(() => {
  scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})

afterEach(() => {
  scrollToSpy.mockRestore()
})
