import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { createRole, setRoleMenus, setRolePermissions } from '../../services/endpoints'
import RolesAdminPage from './RolesAdminPage'

vi.mock('../../services/endpoints', () => ({
  listRoles: vi.fn(async () => ({ results: [] })),
  listPermissions: vi.fn(async () => ({ results: [] })),
  listMenus: vi.fn(async () => ({ results: [] })),
  getRolePermissions: vi.fn(async () => ({ permission_codes: [] })),
  getRoleMenus: vi.fn(async () => ({ menu_ids: [] })),
  createRole: vi.fn(async () => ({ id: 9 })),
  updateRole: vi.fn(),
  deactivateRole: vi.fn(),
  setRolePermissions: vi.fn(async () => ({})),
  setRoleMenus: vi.fn(async () => ({})),
}))

vi.mock('../auth/useAccess', () => ({
  usePermission: () => () => true,
}))

const renderPage = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <RolesAdminPage />
    </QueryClientProvider>,
  )
}

describe('Roles modal', () => {
  it('keeps the form open on a backdrop click, closes on Escape, and submits once', async () => {
    const user = userEvent.setup()
    renderPage()

    const opener = await screen.findByRole('button', { name: 'New role' })
    await user.click(opener)
    const dialog = await screen.findByRole('dialog', { name: 'New role' })
    await user.type(await screen.findByLabelText('Code'), 'editor')
    await user.type(screen.getByLabelText('Name'), 'Editor')

    await user.click(dialog.parentElement)
    expect(dialog).toBeInTheDocument()
    expect(createRole).not.toHaveBeenCalled()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()

    await user.click(opener)
    await user.type(await screen.findByLabelText('Code'), 'editor')
    await user.type(screen.getByLabelText('Name'), 'Editor')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(createRole).toHaveBeenCalledTimes(1))
    expect(createRole).toHaveBeenCalledWith({
      code: 'editor',
      name: 'Editor',
      description: '',
    })
    expect(setRolePermissions).toHaveBeenCalledTimes(1)
    expect(setRoleMenus).toHaveBeenCalledTimes(1)
  })
})
