// src/features/menus/MenusAdminPage.jsx
import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '../../app/queryClient'
import { COMPONENT_REGISTRY } from '../../app/componentRegistry'
import {
  Button,
  Card,
  DataTable,
  Input,
  Modal,
  Select,
  Spinner,
} from '../../components/common/Ui'
import { extractError } from '../../services/http'
import {
  createMenu,
  deactivateMenu,
  listMenus,
  listPermissions,
  updateMenu,
} from '../../services/endpoints'
import { usePermission } from '../auth/useAccess'

const COMPONENT_KEYS = Object.keys(COMPONENT_REGISTRY)

const emptyForm = {
  code: '',
  label: '',
  path: '/',
  component_key: COMPONENT_KEYS[0],
  required_permission: '',
  parent: '',
  sort_order: 0,
  is_active: true,
}

const MenusAdminPage = () => {
  const can = usePermission()
  const queryClient = useQueryClient()
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState(null)

  const menus = useQuery({
    queryKey: queryKeys.menus({ list: true }),
    queryFn: () => listMenus({ page_size: 200 }),
  })
  const permissions = useQuery({
    queryKey: queryKeys.permissions({ all: true }),
    queryFn: () => listPermissions({ page_size: 200 }),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['menus'] })

  const saveMutation = useMutation({
    mutationFn: (payload) =>
      modal?.id ? updateMenu(modal.id, payload) : createMenu(payload),
    onSuccess: () => {
      invalidate()
      setModal(null)
    },
    onError: (err) => setError(extractError(err)),
  })

  const deactivateMutation = useMutation({
    mutationFn: (id) => deactivateMenu(id),
    onSuccess: invalidate,
  })

  const submit = (event) => {
    event.preventDefault()
    setError(null)
    saveMutation.mutate({
      code: form.code,
      label: form.label,
      path: form.path,
      component_key: form.component_key,
      required_permission: form.required_permission || null,
      parent: form.parent ? Number(form.parent) : null,
      sort_order: Number(form.sort_order) || 0,
      is_active: form.is_active,
    })
  }

  const columns = [
    { header: 'Code', key: 'code' },
    { header: 'Label', key: 'label' },
    { header: 'Path', key: 'path' },
    { header: 'Component', key: 'component_key' },
    { header: 'Permission', render: (r) => r.required_permission || '—' },
    { header: 'Order', key: 'sort_order' },
    { header: 'Active', render: (r) => (r.is_active ? 'Yes' : 'No') },
    {
      header: 'Actions',
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          {can('menus.manage') && (
            <Button
              variant="secondary"
              onClick={() => {
                setForm({
                  code: row.code,
                  label: row.label,
                  path: row.path,
                  component_key: row.component_key,
                  required_permission: row.required_permission || '',
                  parent: row.parent ?? '',
                  sort_order: row.sort_order,
                  is_active: row.is_active,
                })
                setError(null)
                setModal(row)
              }}
            >
              Edit
            </Button>
          )}
          {can('menus.manage') && row.is_active && (
            <Button
              variant="danger"
              onClick={() => {
                if (window.confirm(`Deactivate ${row.code}?`))
                  deactivateMutation.mutate(row.id)
              }}
            >
              Deactivate
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <Card
        title="Navigation menus"
        actions={
          can('menus.manage') && (
            <Button
              onClick={() => {
                setForm(emptyForm)
                setError(null)
                setModal({})
              }}
            >
              New menu
            </Button>
          )
        }
      >
        {menus.isLoading ? (
          <Spinner />
        ) : (
          <DataTable columns={columns} rows={menus.data?.results || []} />
        )}
      </Card>

      {modal !== null && (
        <Modal title={modal.id ? 'Edit menu' : 'New menu'} onClose={() => setModal(null)}>
          <form onSubmit={submit} className="space-y-3">
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Input
              label="Code"
              value={form.code}
              onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
              required
            />
            <Input
              label="Label"
              value={form.label}
              onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
              required
            />
            <Input
              label="Path"
              value={form.path}
              onChange={(e) => setForm((p) => ({ ...p, path: e.target.value }))}
              required
            />
            <Select
              label="Component"
              value={form.component_key}
              onChange={(e) => setForm((p) => ({ ...p, component_key: e.target.value }))}
            >
              {COMPONENT_KEYS.map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </Select>
            <Select
              label="Required permission"
              value={form.required_permission}
              onChange={(e) =>
                setForm((p) => ({ ...p, required_permission: e.target.value }))
              }
            >
              <option value="">None</option>
              {(permissions.data?.results || []).map((perm) => (
                <option key={perm.code} value={perm.code}>
                  {perm.code}
                </option>
              ))}
            </Select>
            <Select
              label="Parent"
              value={form.parent}
              onChange={(e) => setForm((p) => ({ ...p, parent: e.target.value }))}
            >
              <option value="">None (top level)</option>
              {(menus.data?.results || [])
                .filter((m) => m.id !== modal.id)
                .map((menu) => (
                  <option key={menu.id} value={menu.id}>
                    {menu.label}
                  </option>
                ))}
            </Select>
            <Input
              label="Sort order"
              type="number"
              value={form.sort_order}
              onChange={(e) => setForm((p) => ({ ...p, sort_order: e.target.value }))}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
              />
              Active
            </label>
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

export default MenusAdminPage
