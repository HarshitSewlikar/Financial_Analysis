import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'

vi.mock('../../features/auth/AuthProvider', () => ({
  useAuth: () => ({ user: { username: 'admin' }, logout: vi.fn() }),
}))
vi.mock('../../features/auth/useAccess', () => ({
  useAccess: () => ({ data: { menus: [] } }),
}))

import AppLayout from './AppLayout'

const Location = () => {
  const location = useLocation()
  return <div>{location.pathname}</div>
}

beforeEach(() => {
  window.matchMedia = (query) => ({
    matches: query.includes('1024'),
    addEventListener() {},
    removeEventListener() {},
  })
})

it('opens the dashboard when the FA name is clicked', async () => {
  render(
    <MemoryRouter initialEntries={['/todos']}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/todos" element={<Location />} />
          <Route path="/dashboard" element={<Location />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )

  await userEvent.click(screen.getByRole('link', { name: /financial analytics/i }))
  expect(screen.getByText('/dashboard')).toBeInTheDocument()
})
