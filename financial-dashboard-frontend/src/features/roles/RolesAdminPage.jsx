// src/features/roles/RolesAdminPage.jsx
import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '../../app/queryClient'
import {
  ActiveBadge,
  AdminPage,
  Badge,
  ConfirmDialog,
  FilterableChecklist,
  FormActions,
} from '../../components/admin/AdminChrome'
import {
  Button,
  Card,
  DataTable,
  Input,
  Modal,
  Spinner,
} from '../../components/common/Ui'
import { extractError } from '../../services/http'
import {
  createRole,
  deactivateRole,
  getRoleMenus,
  getRolePermissions,
  listMenus,
  listPermissions,
  listRoles,
  setRoleMenus,
  setRolePermissions,
  updateRole,
} from '../../services/endpoints'
import { usePermission } from '../auth/useAccess'

const RolesAdminPage = () => {
  const can = usePermission()
  const queryClient = useQueryClient()
  const [modal, setModal] = useState(null)
  const [confirmRole, setConfirmRole] = useState(null)
  const [roleQuery, setRoleQuery] = useState('')

  const roles = useQuery({
    queryKey: queryKeys.roles({ list: true }),
    queryFn: () => listRoles({ page_size: 200 }),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['roles'] })
    queryClient.invalidateQueries({ queryKey: queryKeys.authAccess })
  }

  const deactivateMutation = useMutation({
    mutationFn: (id) => deactivateRole(id),
    onSuccess: () => {
      invalidate()
      setConfirmRole(null)
    },
  })

  const needle = roleQuery.trim().toLowerCase()
  const visibleRoles = (roles.data?.results || []).filter((role) => {
    if (!needle) return true
    return [role.code, role.name, role.description]
      .join(' ')
      .toLowerCase()
      .includes(needle)
  })

  const columns = [
    {
      header: 'Role',
      key: 'name',
      render: (row) => (
        <button type="button" className="text-left" onClick={() => setModal(row)}>
          <span className="font-semibold text-ink">{row.name}</span>
          {row.is_system && <Badge tone="warning">Built-in</Badge>}
          <span className="mt-0.5 block text-xs text-ink-muted">{row.code}</span>
        </button>
      ),
    },
    { header: 'Description', key: 'description', render: (row) => row.description || '—' },
    { header: 'Users', key: 'user_count', className: 'text-right tabular-nums' },
    { header: 'Status', key: 'status', render: (row) => <ActiveBadge active={row.is_active} /> },
    {
      header: 'Actions',
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          {can('roles.manage') && (
            <Button
              variant="outline"
              onClick={() => {
                setModal(row)
              }}
            >
              Edit
            </Button>
          )}
          {can('roles.manage') && !row.is_system && row.is_active && (
            <Button variant="danger" onClick={() => setConfirmRole(row)}>
              Deactivate
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <AdminPage
      title="Roles"
      description="A role is a reusable set of permissions. Assign a role to a person instead of ticking every permission one by one."
      actions={
        can('roles.manage') && (
          <Button
            onClick={() => {
              setModal({})
            }}
          >
            New role
          </Button>
        )
      }
    >
      <Card>
        <div className="mb-4 max-w-md rounded-2xl border border-line bg-indigo-soft p-4">
          <Input
            label="Search roles"
            placeholder="Name, code, or description"
            value={roleQuery}
            onChange={(event) => setRoleQuery(event.target.value)}
          />
        </div>
        {roles.isLoading ? (
          <Spinner label="Loading roles…" />
        ) : (
          <DataTable
            columns={columns}
            rows={visibleRoles}
            emptyMessage={
              needle
                ? `No roles match “${roleQuery.trim()}”.`
                : 'No roles yet. Create one and choose the permissions it includes.'
            }
          />
        )}
      </Card>

      {modal && (
        <RoleEditor
          role={modal.id ? modal : null}
          canAssign={can('permissions.assign')}
          canMenus={can('menus.assign')}
          onClose={() => setModal(null)}
          onSaved={invalidate}
        />
      )}

      {confirmRole && (
        <ConfirmDialog
          title={`Deactivate ${confirmRole.name}?`}
          message="People who only have this role will lose the permissions that came from it."
          confirmLabel="Deactivate"
          pending={deactivateMutation.isPending}
          onClose={() => setConfirmRole(null)}
          onConfirm={() => deactivateMutation.mutate(confirmRole.id)}
        />
      )}
    </AdminPage>
  )
}

const emptyRole = { code: '', name: '', description: '', is_active: true }

const RoleEditor = ({ role, canAssign, canMenus, onClose, onSaved }) => {
  const [savedId, setSavedId] = useState(role?.id || null)
  const [form, setForm] = useState(
    role
      ? {
          code: role.code,
          name: role.name,
          description: role.description || '',
          is_active: role.is_active,
        }
      : emptyRole
  )
  const [selected, setSelected] = useState(null)
  const [selectedMenus, setSelectedMenus] = useState(null)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)

  const permissions = useQuery({
    queryKey: queryKeys.permissions({ all: true }),
    queryFn: () => listPermissions({ page_size: 200 }),
    enabled: canAssign,
  })
  const current = useQuery({
    queryKey: ['role-permissions', savedId],
    queryFn: () => getRolePermissions(savedId),
    enabled: canAssign && Boolean(savedId),
  })

  const menus = useQuery({
    queryKey: queryKeys.menus({ all: true }),
    queryFn: () => listMenus({ page_size: 200 }),
    enabled: canMenus,
  })
  const currentMenus = useQuery({
    queryKey: ['role-menus', savedId],
    queryFn: () => getRoleMenus(savedId),
    enabled: canMenus && Boolean(savedId),
  })

  const codes = selected ?? current.data?.permission_codes ?? []
  const menuIds = selectedMenus ?? currentMenus.data?.menu_ids ?? []
  const loading =
    (canAssign && (permissions.isLoading || (savedId && current.isLoading))) ||
    (canMenus && (menus.isLoading || (savedId && currentMenus.isLoading)))

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = savedId
        ? { name: form.name, description: form.description, is_active: form.is_active }
        : { code: form.code, name: form.name, description: form.description }
      const saved = savedId ? await updateRole(savedId, payload) : await createRole(payload)
      setSavedId(saved.id)
      if (canAssign) await setRolePermissions(saved.id, codes)
      if (canMenus) await setRoleMenus(saved.id, menuIds)
      return saved
    },
    onSuccess: () => {
      setNotice('Saved. The role list has been reloaded from the server.')
      onSaved()
    },
    onError: (err) => setError(extractError(err)),
  })

  const toggle = (code) =>
    setSelected(codes.includes(code) ? codes.filter((item) => item !== code) : [...codes, code])

  const toggleMenu = (id) =>
    setSelectedMenus(menuIds.includes(id) ? menuIds.filter((item) => item !== id) : [...menuIds, id])

  const submit = (event) => {
    event.preventDefault()
    setError(null)
    setNotice(null)
    mutation.mutate()
  }

  return (
    <Modal title={savedId ? 'Edit role' : 'New role'} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-3">
        {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
        {notice && <p className="text-sm text-emerald-800" role="status">{notice}</p>}
        {!savedId && (
          <Input
            label="Code"
            value={form.code}
            onChange={(event) => setForm((currentForm) => ({ ...currentForm, code: event.target.value }))}
            required
          />
        )}
        <Input
          label="Name"
          value={form.name}
          onChange={(event) => setForm((currentForm) => ({ ...currentForm, name: event.target.value }))}
          required
        />
        <Input
          label="Description"
          value={form.description}
          onChange={(event) => setForm((currentForm) => ({ ...currentForm, description: event.target.value }))}
        />
        {role?.assigned_usernames?.length > 0 && (
          <p className="text-sm text-ink-secondary">
            Assigned users: {role.assigned_usernames.join(', ')}
          </p>
        )}
        {savedId && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) => setForm((currentForm) => ({ ...currentForm, is_active: event.target.checked }))}
            />
            Active
          </label>
        )}
        {canAssign && (
          loading ? (
            <Spinner label="Loading permissions…" />
          ) : (
            <>
              <p className="text-sm text-ink-secondary">
                Checked permissions are the default for everyone assigned this role. They are saved as separate rows, not copied into the page.
              </p>
              <FilterableChecklist
                items={(permissions.data?.results || []).filter((perm) => perm.is_active !== false)}
                idOf={(perm) => perm.code}
                labelOf={(perm) => perm.code}
                detailOf={(perm) => perm.description}
                isChecked={(perm) => codes.includes(perm.code)}
                onToggle={(perm) => toggle(perm.code)}
                searchLabel="Find a permission"
              />
            </>
          )
        )}
        {canMenus && !loading && (
          <>
            <h2 className="pt-2 text-sm font-semibold text-ink">Menu visibility</h2>
            <p className="text-sm text-ink-secondary">
              Checked menus appear in the sidebar for people with this role. A menu can still stay hidden when the person lacks its required permission.
            </p>
            <FilterableChecklist
              items={(menus.data?.results || []).filter((menu) => menu.is_active !== false)}
              idOf={(menu) => menu.id}
              labelOf={(menu) => menu.label}
              detailOf={(menu) => menu.path}
              isChecked={(menu) => menuIds.includes(menu.id)}
              onToggle={(menu) => toggleMenu(menu.id)}
              searchLabel="Find a menu"
            />
          </>
        )}
        {!loading && <FormActions onCancel={onClose} pending={mutation.isPending} />}
      </form>
    </Modal>
  )
}


export default RolesAdminPage
