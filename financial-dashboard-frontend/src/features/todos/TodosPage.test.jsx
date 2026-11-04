import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { deleteTodo, listTodos } from '../../services/endpoints'
import TodosPage from './TodosPage'

vi.mock('../../services/endpoints', () => ({
  listTodos: vi.fn(),
  createTodo: vi.fn(),
  updateTodo: vi.fn(),
  deleteTodo: vi.fn(),
  setTodoStatus: vi.fn(),
}))

vi.mock('../auth/useAccess', () => ({
  usePermission: () => () => true,
}))

const row = {
  id: 7,
  title: 'Disposable fixture',
  description: '',
  status: 'open',
  priority: 'normal',
  assignee_username: '',
  due_at: null,
}

const renderPage = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <TodosPage />
    </QueryClientProvider>,
  )
}

describe('Todos page', () => {
  it('uses the admin heading and visible filter labels', async () => {
    listTodos.mockResolvedValue({ count: 0, results: [] })
    renderPage()

    expect(await screen.findByRole('heading', { name: 'To-dos', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Work items for this workspace. Filters apply to the list below.')).toBeInTheDocument()
    expect(screen.getByLabelText('Status')).toHaveValue('')
    expect(screen.getByLabelText('Priority')).toHaveValue('')
    expect(await screen.findByText('No to-dos found.')).toBeInTheDocument()
  })

  it('cancels deletion without calling the mutation, then confirms once', async () => {
    const user = userEvent.setup()
    listTodos.mockResolvedValue({ count: 1, results: [row] })
    deleteTodo.mockResolvedValue({})
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Delete' }))
    expect(screen.getByRole('dialog', { name: 'Delete this to-do?' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(deleteTodo).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(deleteTodo).toHaveBeenCalledTimes(1))
    expect(deleteTodo).toHaveBeenCalledWith(7)
  })
})
