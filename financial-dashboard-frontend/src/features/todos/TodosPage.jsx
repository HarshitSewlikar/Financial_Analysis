// src/features/todos/TodosPage.jsx
import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '../../app/queryClient'
import {
  Button,
  Card,
  DataTable,
  Input,
  Modal,
  Pagination,
  Select,
  Spinner,
} from '../../components/common/Ui'
import { extractError } from '../../services/http'
import {
  createTodo,
  deleteTodo,
  listTodos,
  setTodoStatus,
  updateTodo,
} from '../../services/endpoints'
import { usePermission } from '../auth/useAccess'

const STATUSES = ['open', 'in_progress', 'blocked', 'completed', 'cancelled']
const PRIORITIES = ['low', 'normal', 'high', 'urgent']

const NEXT_STATUS = {
  open: 'in_progress',
  in_progress: 'completed',
  blocked: 'in_progress',
  completed: 'open',
  cancelled: 'open',
}

const statusLabel = (value) => value.replace('_', ' ')

const emptyForm = { title: '', description: '', priority: 'normal', due_at: '' }

const TodosPage = () => {
  const can = usePermission()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({ status: '', priority: '' })
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState(null)

  const params = { page, page_size: 25, ...filters }
  const todos = useQuery({
    queryKey: queryKeys.todos(params),
    queryFn: () => listTodos(params),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['todos'] })

  const saveMutation = useMutation({
    mutationFn: (payload) =>
      modal?.id ? updateTodo(modal.id, payload) : createTodo(payload),
    onSuccess: () => {
      invalidate()
      setModal(null)
      setForm(emptyForm)
    },
    onError: (err) => setError(extractError(err)),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => setTodoStatus(id, status),
    onSuccess: invalidate,
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteTodo(id),
    onSuccess: invalidate,
  })

  const openCreate = () => {
    setForm(emptyForm)
    setError(null)
    setModal({})
  }

  const openEdit = (todo) => {
    setForm({
      title: todo.title,
      description: todo.description,
      priority: todo.priority,
      due_at: todo.due_at ? todo.due_at.slice(0, 16) : '',
    })
    setError(null)
    setModal(todo)
  }

  const submit = (event) => {
    event.preventDefault()
    setError(null)
    const payload = {
      title: form.title,
      description: form.description,
      priority: form.priority,
      due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
    }
    saveMutation.mutate(payload)
  }

  const columns = [
    { header: 'Title', key: 'title' },
    { header: 'Status', render: (r) => statusLabel(r.status) },
    { header: 'Priority', key: 'priority' },
    { header: 'Assignee', render: (r) => r.assignee_username || '—' },
    {
      header: 'Due',
      render: (r) => (r.due_at ? new Date(r.due_at).toLocaleDateString() : '—'),
    },
    {
      header: 'Actions',
      render: (row) => (
        <div className="flex gap-2">
          {can('todos.update') && (
            <Button
              variant="secondary"
              onClick={() =>
                statusMutation.mutate({ id: row.id, status: NEXT_STATUS[row.status] })
              }
            >
              → {statusLabel(NEXT_STATUS[row.status])}
            </Button>
          )}
          {can('todos.update') && (
            <Button variant="secondary" onClick={() => openEdit(row)}>
              Edit
            </Button>
          )}
          {can('todos.delete') && (
            <Button
              variant="danger"
              onClick={() => {
                if (window.confirm('Delete this to-do?')) deleteMutation.mutate(row.id)
              }}
            >
              Delete
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <Card
        title="To-dos"
        actions={
          can('todos.create') && <Button onClick={openCreate}>New to-do</Button>
        }
      >
        <div className="mb-3 flex flex-wrap gap-3">
          <Select
            value={filters.status}
            onChange={(e) => {
              setPage(1)
              setFilters((p) => ({ ...p, status: e.target.value }))
            }}
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </Select>
          <Select
            value={filters.priority}
            onChange={(e) => {
              setPage(1)
              setFilters((p) => ({ ...p, priority: e.target.value }))
            }}
          >
            <option value="">All priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </div>
        {todos.isLoading ? (
          <Spinner />
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={todos.data?.results || []}
              emptyMessage="No to-dos found."
            />
            <Pagination
              page={page}
              pageSize={25}
              total={todos.data?.count}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>

      {modal !== null && (
        <Modal title={modal.id ? 'Edit to-do' : 'New to-do'} onClose={() => setModal(null)}>
          <form onSubmit={submit} className="space-y-3">
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Input
              label="Title"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              required
            />
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Description</span>
              <textarea
                className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                rows={3}
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              />
            </label>
            <Select
              label="Priority"
              value={form.priority}
              onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
            <Input
              label="Due at"
              type="datetime-local"
              value={form.due_at}
              onChange={(e) => setForm((p) => ({ ...p, due_at: e.target.value }))}
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" type="button" onClick={() => setModal(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                Save
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default TodosPage
