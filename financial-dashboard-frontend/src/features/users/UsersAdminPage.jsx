import React, { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '../../app/queryClient'
import {
  ActiveBadge,
  AdminPage,
  Badge,
  ConfirmDialog,
  FormActions,
  groupByResource,
} from '../../components/admin/AdminChrome'
import {
  Button,
  Card,
  DataTable,
  Input,
  Modal,
  Pagination,
  Spinner,
} from '../../components/common/Ui'
import { extractError } from '../../services/http'
import {
  createUser,
  deactivateUser,
  getUserOverrides,
  listRoles,
  listUsers,
  setUserOverrides,
  setUserRoles,
  updateUser,
} from '../../services/endpoints'
import { usePermission } from '../auth/useAccess'

const emptyForm = { username: '', name: '', email: '', password: '', is_active: true }

const UsersAdminPage = () => {
  const can = usePermission()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)
  const [confirmUser, setConfirmUser] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1)
      setSearch(searchInput.trim())
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const users = useQuery({
    queryKey: queryKeys.users({ page, search }),
    queryFn: () => listUsers({ page, page_size: 25, search: search || undefined }),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['users'] })
    queryClient.invalidateQueries({ queryKey: queryKeys.authAccess })
  }

  const saveMutation = useMutation({
    mutationFn: (payload) =>
      modal?.id ? updateUser(modal.id, payload) : createUser(payload),
    onSuccess: () => {
      invalidate()
      setModal(null)
    },
    onError: (err) => setError(extractError(err)),
  })

  const deactivateMutation = useMutation({
    mutationFn: (id) => deactivateUser(id),
    onSuccess: () => {
      invalidate()
      setConfirmUser(null)
    },
  })

  const openCreate = () => {
    setForm(emptyForm)
    setError(null)
    setModal({})
  }

  const openEdit = (user) => {
    setForm({
      username: user.username,
      name: user.name || '',
      email: user.email || '',
      password: '',
      is_active: user.is_active,
    })
    setError(null)
    setModal(user)
  }

  const submit = (event) => {
    event.preventDefault()
    setError(null)
    if (modal?.id) {
      const payload = { name: form.name, email: form.email, is_active: form.is_active }
      if (form.password) payload.password = form.password
      saveMutation.mutate(payload)
    } else {
      saveMutation.mutate({
        username: form.username,
        name: form.name,
        email: form.email,
        password: form.password,
        is_active: form.is_active,
      })
    }
  }

  const columns = [
    {
      header: 'Username',
      key: 'username',
      render: (row) => (
        <button
          type="button"
          className="font-semibold text-ink underline-offset-2 hover:text-accent hover:underline"
          onClick={() => setModal({ accessFor: row })}
        >
          {row.username}
        </button>
      ),
    },
    { header: 'Name', key: 'name', render: (row) => row.name || '—' },
    { header: 'Email', key: 'email', render: (row) => row.email || '—' },
    {
      header: 'Roles',
      key: 'roles',
      render: (row) =>
        row.roles?.length ? (
          <div className="flex max-w-xs flex-wrap gap-1">
            {row.roles.map((role) => (
              <Badge key={role}>{role}</Badge>
            ))}
          </div>
        ) : (
          '—'
        ),
    },
    { header: 'Status', key: 'status', render: (row) => <ActiveBadge active={row.is_active} /> },
    {
      header: 'Actions',
      key: 'actions',
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          {can('users.update') && (
            <Button variant="outline" onClick={() => openEdit(row)}>
              Edit
            </Button>
          )}
          <Button variant="ghost" onClick={() => setModal({ accessFor: row })}>
            Access
          </Button>
          {can('users.deactivate') && row.is_active && (
            <Button variant="danger" onClick={() => setConfirmUser(row)}>
              Deactivate
            </Button>
          )}
        </div>
      ),
    },
  ]

  const emptyMessage = search
    ? `No users match “${search}”. Try a shorter name, username, or email.`
    : 'No users yet. Create an account to give someone access.'

  return (
    <AdminPage
      title="Users"
      description="Open a user to change their role and permissions."
      actions={can('users.create') && <Button onClick={openCreate}>New user</Button>}
    >
      <Card>
        <div className="mb-4 max-w-md rounded-2xl border border-line bg-indigo-soft p-4">
          <Input
            label="Search users"
            placeholder="Username, name, or email"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </div>
        {users.isLoading ? (
          <Spinner label="Loading users…" />
        ) : users.isError ? (
          <p className="text-sm text-red-700">{extractError(users.error)}</p>
        ) : (
          <>
            <DataTable columns={columns} rows={users.data?.results || []} emptyMessage={emptyMessage} />
            <Pagination page={page} pageSize={25} total={users.data?.count} onPageChange={setPage} />
          </>
        )}
      </Card>

      {modal && !modal.accessFor && (
        <Modal title={modal.id ? 'Edit user' : 'New user'} onClose={() => setModal(null)}>
          <form onSubmit={submit} className="space-y-3">
            {error && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {error}
              </p>
            )}
            {!modal.id && (
              <Input
                label="Username"
                value={form.username}
                onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
                required
                minLength={3}
                autoComplete="off"
              />
            )}
            <Input
              label="Name"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              autoComplete="name"
            />
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              autoComplete="email"
            />
            <Input
              label={modal.id ? 'New password' : 'Password'}
              type="password"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              required={!modal.id}
              autoComplete="new-password"
              minLength={modal.id ? undefined : 8}
            />
            {modal.id && (
              <p className="text-xs text-ink-muted">Leave the password blank to keep the current one.</p>
            )}
            {modal.id && (
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, is_active: event.target.checked }))
                  }
                />
                Account can sign in
              </label>
            )}
            <FormActions onCancel={() => setModal(null)} pending={saveMutation.isPending} />
          </form>
        </Modal>
      )}

      {modal?.accessFor && (
        <UserAccessPanel
          user={modal.accessFor}
          canAssignRoles={can('roles.assign')}
          canAssignPermissions={can('permissions.assign')}
          onClose={() => setModal(null)}
          onChanged={invalidate}
        />
      )}

      {confirmUser && (
        <ConfirmDialog
          title={`Deactivate ${confirmUser.username}?`}
          message="They will no longer be able to sign in. Their records stay in the database."
          confirmLabel="Deactivate"
          pending={deactivateMutation.isPending}
          onClose={() => setConfirmUser(null)}
          onConfirm={() => deactivateMutation.mutate(confirmUser.id)}
        />
      )}
    </AdminPage>
  )
}

const UserAccessPanel = ({ user, canAssignRoles, canAssignPermissions, onClose, onChanged }) => {
  const queryClient = useQueryClient()
  const accessQuery = useQuery({
    queryKey: ['user-access', user.id],
    queryFn: () => getUserOverrides(user.id),
  })
  const roles = useQuery({
    queryKey: queryKeys.roles({ all: true }),
    queryFn: () => listRoles({ page_size: 200 }),
    enabled: canAssignRoles,
  })
  const [roleIds, setRoleIds] = useState(null)
  const [filter, setFilter] = useState('')
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [optimistic, setOptimistic] = useState(null)
  const [permissionStatus, setPermissionStatus] = useState(null)

  const server = accessQuery.data?.access
  const permissions = server?.permissions || []
  const selectedRoles = roleIds ?? (server?.roles || []).map((role) => role.id)

  const roleMutation = useMutation({
    mutationFn: () => setUserRoles(user.id, selectedRoles),
    onSuccess: async () => {
      setRoleIds(null)
      setOptimistic(null)
      await queryClient.invalidateQueries({ queryKey: ['user-access', user.id] })
      onChanged()
      setNotice('Role saved. Effective permissions were reloaded from the server.')
    },
    onError: (err) => setError(extractError(err)),
  })

  const permissionMutation = useMutation({
    mutationFn: (overrides) => setUserOverrides(user.id, overrides),
    onSuccess: (data) => {
      queryClient.setQueryData(['user-access', user.id], data)
      setOptimistic(null)
      onChanged()
      setPermissionStatus({ tone: 'saved', text: 'Saved' })
    },
    onError: (err) => {
      setOptimistic(null)
      setPermissionStatus({ tone: 'error', text: extractError(err) })
    },
  })

  const overridesExcept = (code) =>
    permissions
      .filter((perm) => perm.override && perm.code !== code)
      .map((perm) => ({ permission_code: perm.code, effect: perm.override }))

  const savePermission = (code, overrides, checked) => {
    setError(null)
    setOptimistic({ code, checked })
    setPermissionStatus({ tone: 'saving', text: 'Saving…' })
    permissionMutation.mutate(overrides)
  }

  const togglePermission = (perm, checked) => {
    savePermission(perm.code, [
      ...overridesExcept(perm.code),
      { permission_code: perm.code, effect: checked ? 'ALLOW' : 'DENY' },
    ], checked)
  }

  const resetPermission = (perm) => {
    savePermission(perm.code, overridesExcept(perm.code), Boolean(perm.from_role))
  }

  const checkedPermission = (perm) =>
    optimistic?.code === perm.code ? optimistic.checked : Boolean(perm.effective)

  const savingAccess = permissionMutation.isPending

  const needle = filter.trim().toLowerCase()
  const visible = permissions.filter((perm) => {
    if (!needle) return true
    return (
      perm.code.toLowerCase().includes(needle) ||
      perm.resource.toLowerCase().includes(needle) ||
      String(perm.description || '').toLowerCase().includes(needle)
    )
  })
  const locked = Boolean(server?.is_protected_admin)

  return (
    <Modal title={`Access for ${user.username}`} onClose={onClose} width="max-w-5xl">
      {accessQuery.isLoading ? (
        <Spinner label="Loading access…" />
      ) : accessQuery.isError ? (
        <p className="text-sm text-red-700">{extractError(accessQuery.error)}</p>
      ) : (
        <div className="space-y-5">
          {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
          {notice && <p className="text-sm text-emerald-800" role="status">{notice}</p>}
          <div className="flex flex-wrap items-center gap-2 text-sm text-ink-secondary">
            <span className="font-medium text-ink">{server.username}</span>
            <ActiveBadge active={server.is_active} />
            {locked && <Badge tone="warning">Protected administrator</Badge>}
          </div>
          {locked && (
            <p className="text-sm text-ink-secondary">
              This account keeps every registered permission. Individual changes are not stored for it.
            </p>
          )}

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-ink">Assigned roles</h2>
            <p className="text-sm text-ink-secondary">
              Current roles: {(server.roles || []).map((role) => role.name).join(', ') || 'None'}.
            </p>
            {canAssignRoles && (
              roles.isLoading ? (
                <Spinner label="Loading roles…" />
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {(roles.data?.results || []).filter((role) => role.is_active).map((role) => (
                    <label key={role.id} className="flex cursor-pointer items-start gap-2 rounded-md border border-line px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={selectedRoles.includes(role.id)}
                        onChange={() => {
                          setNotice(null)
                          const next = selectedRoles.includes(role.id)
                            ? selectedRoles.filter((id) => id !== role.id)
                            : [...selectedRoles, role.id]
                          setRoleIds(next)
                        }}
                      />
                      <span>
                        <span className="font-medium text-ink">{role.name}</span>
                        <span className="mt-0.5 block text-xs text-ink-muted">{role.code}</span>
                      </span>
                    </label>
                  ))}
                </div>
              )
            )}
            {canAssignRoles && (
              <div className="flex justify-end">
                <Button type="button" onClick={() => { setError(null); roleMutation.mutate() }} disabled={roleMutation.isPending}>
                  {roleMutation.isPending ? 'Saving…' : 'Save role'}
                </Button>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-ink">Permissions</h2>
              {permissionStatus && (
                <p
                  className={`text-xs ${permissionStatus.tone === 'error' ? 'text-red-700' : 'text-ink-muted'}`}
                  role={permissionStatus.tone === 'error' ? 'alert' : 'status'}
                >
                  {permissionStatus.text}
                </p>
              )}
            </div>
            <Input
              label="Find a permission"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Module or permission, such as todos"
            />
            <div className="space-y-4">
              {groupByResource(visible).map(([resource, group]) => (
                <div key={resource}>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    {resource}
                  </h3>
                  <div className="divide-y divide-line rounded-md border border-line">
                    {group.map((perm) => (
                      <div key={perm.code} className="flex items-center gap-3 px-3 py-1.5">
                        <label className="flex min-w-0 flex-1 items-center gap-3">
                          <input
                            type="checkbox"
                            className="shrink-0"
                            checked={checkedPermission(perm)}
                            disabled={locked || !canAssignPermissions || savingAccess}
                            onChange={(event) => togglePermission(perm, event.target.checked)}
                          />
                          <span className="min-w-0">
                            <span className="text-sm text-ink">{perm.description || perm.code}</span>
                            {perm.description && (
                              <span className="ml-2 text-xs text-ink-muted">{perm.code}</span>
                            )}
                          </span>
                        </label>
                        <span className="shrink-0 text-xs text-ink-muted">
                          {perm.from_role ? 'In role' : 'Not in role'}
                          {perm.override === 'ALLOW' ? ' · allowed for this user' : ''}
                          {perm.override === 'DENY' ? ' · denied for this user' : ''}
                        </span>
                        {perm.override && canAssignPermissions && !locked && (
                          <button
                            type="button"
                            className="shrink-0 text-xs text-ink-secondary underline"
                            disabled={savingAccess}
                            onClick={() => resetPermission(perm)}
                          >
                            Use role default
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </Modal>
  )
}

export default UsersAdminPage
