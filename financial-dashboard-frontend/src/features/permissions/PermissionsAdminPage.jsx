// src/features/permissions/PermissionsAdminPage.jsx
import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '../../app/queryClient'
import {
  ActiveBadge,
  AdminPage,
  Badge,
  ConfirmDialog,
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
  createPermission,
  deactivatePermission,
  listPermissions,
  updatePermission,
} from '../../services/endpoints'
import { useAuth } from '../auth/AuthProvider'
import { usePermission } from '../auth/useAccess'

const emptyForm = { code: '', resource: '', action: '', description: '' }

const PermissionsAdminPage = () => {
  const can = usePermission()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [modal, setModal] = useState(null)
  const [confirmPermission, setConfirmPermission] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState(null)

  const permissions = useQuery({
    queryKey: queryKeys.permissions({ list: true }),
    queryFn: () => listPermissions({ page_size: 200 }),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['permissions'] })

  const saveMutation = useMutation({
    mutationFn: (payload) =>
      modal?.id ? updatePermission(modal.id, payload) : createPermission(payload),
    onSuccess: () => {
      invalidate()
      setModal(null)
    },
    onError: (err) => setError(extractError(err)),
  })

  const deactivateMutation = useMutation({
    mutationFn: (id) => deactivatePermission(id),
    onSuccess: () => {
      invalidate()
      setConfirmPermission(null)
    },
  })

  const submit = (event) => {
    event.preventDefault()
    setError(null)
    const payload = modal?.id
      ? { description: form.description }
      : {
          code: form.code,
          resource: form.resource,
          action: form.action,
          description: form.description,
        }
    saveMutation.mutate(payload)
  }

  const columns = [
    { header: 'Code', key: 'code' },
    { header: 'Resource', key: 'resource' },
    { header: 'Action', key: 'action' },
    { header: 'Type', key: 'type', render: (row) => <Badge tone={row.is_system ? 'warning' : 'neutral'}>{row.is_system ? 'Built-in' : 'Custom'}</Badge> },
    { header: 'Enforced', key: 'effective', render: (row) => <Badge tone={row.is_effective ? 'success' : 'danger'}>{row.is_effective ? 'Enforced' : 'Not enforced'}</Badge> },
    { header: 'Status', key: 'status', render: (row) => <ActiveBadge active={row.is_active} /> },
    {
      header: 'Actions',
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          {can('permissions.manage') && (
            <Button
              variant="secondary"
              onClick={() => {
                setForm({
                  code: row.code,
                  resource: row.resource,
                  action: row.action,
                  description: row.description || '',
                })
                setError(null)
                setModal(row)
              }}
            >
              Edit
            </Button>
          )}
          {can('permissions.manage') && !row.is_system && row.is_active && (
            <Button variant="danger" onClick={() => setConfirmPermission(row)}>
              Deactivate
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <AdminPage
      title="Permissions"
      description="These are the individual actions a role can include, such as reading to-dos or exporting the audit log."
      actions={
        user?.is_protected_admin && (
          <Button
            onClick={() => {
              setForm(emptyForm)
              setError(null)
              setModal({})
            }}
          >
            New permission
          </Button>
        )
      }
    >
      <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
        A row here is enforced only when its code also exists in the application catalog. “Not enforced” means the website ignores it. Only the protected administrator can add a code.
      </p>
      <Card>
        {permissions.isLoading ? (
          <Spinner label="Loading permissions…" />
        ) : (
          <DataTable
            columns={columns}
            rows={permissions.data?.results || []}
            emptyMessage="No permissions are defined yet."
          />
        )}
      </Card>

      {modal !== null && (
        <Modal
          title={modal.id ? 'Edit permission' : 'New permission'}
          onClose={() => setModal(null)}
        >
          <form onSubmit={submit} className="space-y-3">
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Input
              label="Code"
              value={form.code}
              disabled={!!modal.id}
              onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
              placeholder="e.g. reports.view"
              required
            />
            <Input
              label="Resource"
              value={form.resource}
              disabled={!!modal.id}
              onChange={(e) => setForm((p) => ({ ...p, resource: e.target.value }))}
              required
            />
            <Input
              label="Action"
              value={form.action}
              disabled={!!modal.id}
              onChange={(e) => setForm((p) => ({ ...p, action: e.target.value }))}
              required
            />
            <Input
              label="Description"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            />
            {!modal.id && (
              <p className="text-xs text-slate-500">
                New codes are recorded but stay inert until registered in the backend
                permission catalog.
              </p>
            )}
            <FormActions onCancel={() => setModal(null)} pending={saveMutation.isPending} />
          </form>
        </Modal>
      )}

      {confirmPermission && (
        <ConfirmDialog
          title={`Deactivate ${confirmPermission.code}?`}
          message="Roles that include this permission will no longer grant it."
          confirmLabel="Deactivate"
          pending={deactivateMutation.isPending}
          onClose={() => setConfirmPermission(null)}
          onConfirm={() => deactivateMutation.mutate(confirmPermission.id)}
        />
      )}
    </AdminPage>
  )
}

export default PermissionsAdminPage
