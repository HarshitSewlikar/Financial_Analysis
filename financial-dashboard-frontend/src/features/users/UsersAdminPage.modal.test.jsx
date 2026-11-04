import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { createUser, listUsers } from '../../services/endpoints'
import UsersAdminPage from './UsersAdminPage'

vi.mock('../../services/endpoints', () => ({
  listUsers: vi.fn(async () => ({ count: 0, results: [] })),
  createUser: vi.fn(async () => ({ id: 1 })),
  updateUser: vi.fn(),
  deactivateUser: vi.fn(),
  getUserOverrides: vi.fn(),
  listRoles: vi.fn(async () => ({ results: [] })),
  setUserOverrides: vi.fn(),
  setUserRoles: vi.fn(),
}))

vi.mock('../auth/useAccess', () => ({
  usePermission: () => () => true,
}))

const renderPage = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <UsersAdminPage />
    </QueryClientProvider>,
  )
}

describe('Users modal', () => {
  it('keeps the form open on a backdrop click, closes on Escape, and submits once', async () => {
    const user = userEvent.setup()
    renderPage()

    const opener = await screen.findByRole('button', { name: 'New user' })
    await user.click(opener)
    const dialog = await screen.findByRole('dialog', { name: 'New user' })
    await user.type(screen.getByLabelText('Username'), 'ada')
    expect(screen.getByLabelText('Username')).toHaveValue('ada')

    await user.click(dialog.parentElement)
    expect(dialog).toBeInTheDocument()
    expect(createUser).not.toHaveBeenCalled()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()

    await user.click(opener)
    await user.type(screen.getByLabelText('Username'), 'ada')
    await user.type(screen.getByLabelText('Password'), 'correct-horse')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(createUser).toHaveBeenCalledTimes(1)
    expect(createUser).toHaveBeenCalledWith({
      username: 'ada',
      name: '',
      email: '',
      password: 'correct-horse',
      is_active: true,
    })
    expect(listUsers).toHaveBeenCalled()
  })
})
