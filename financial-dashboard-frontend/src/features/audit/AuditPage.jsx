// src/features/audit/AuditPage.jsx
import React, { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '../../app/queryClient'
import { AdminPage } from '../../components/admin/AdminChrome'
import { Badge } from '../../components/admin/AdminChrome'
import { Button, Card, DataTable, Input, Select, Spinner } from '../../components/common/Ui'
import { http } from '../../services/http'
import { listAudit } from '../../services/endpoints'
import { usePermission } from '../auth/useAccess'

const RESOURCE_TYPES = ['User', 'Role', 'Permission', 'Menu', 'Todo']

const actionTone = (action) => {
  const value = String(action || '').toLowerCase()
  if (value.includes('fail') || value.includes('delete') || value.includes('deactivat')) return 'danger'
  if (value.includes('create') || value.includes('succeed')) return 'success'
  if (value.includes('update') || value.includes('edit')) return 'warning'
  return 'info'
}

const cursorFrom = (url) => {
  if (!url) return null
  try {
    return new URL(url).searchParams.get('cursor')
  } catch {
    return null
  }
}

const AuditPage = () => {
  const can = usePermission()
  const [filters, setFilters] = useState({ resource_type: '', search: '' })
  const [searchInput, setSearchInput] = useState('')
  const [exporting, setExporting] = useState(false)
  const [cursorStack, setCursorStack] = useState([null])
  const cursor = cursorStack[cursorStack.length - 1]

  useEffect(() => {
    const timer = setTimeout(() => {
      setCursorStack([null])
      setFilters((current) => ({ ...current, search: searchInput.trim() }))
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const audit = useQuery({
    queryKey: queryKeys.audit({ ...filters, cursor }),
    queryFn: () =>
      listAudit({
        cursor: cursor || undefined,
        resource_type: filters.resource_type || undefined,
        search: filters.search || undefined,
      }),
  })

  const exportCsv = async () => {
    setExporting(true)
    try {
      const response = await http.get('/audit-logs/export/', {
        params: {
          resource_type: filters.resource_type || undefined,
          search: filters.search || undefined,
        },
        responseType: 'blob',
      })
      const url = URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url
      link.download = 'audit_logs.csv'
      link.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  const columns = [
    {
      header: 'When',
      render: (r) => new Date(r.created_at).toLocaleString(),
    },
    { header: 'Actor', render: (r) => r.actor_username || '—' },
    {
      header: 'Action',
      key: 'action',
      render: (row) => {
        const label = String(row.action || '').replaceAll('_', ' ')
        return <Badge tone={actionTone(row.action)}>{label || '—'}</Badge>
      },
    },
    { header: 'Resource', key: 'resource_type' },
    { header: 'Object', render: (r) => r.object_id || '—' },
    { header: 'IP', render: (r) => r.ip_address || '—' },
  ]

  const emptyMessage =
    filters.search || filters.resource_type
      ? 'No events match these filters. Clear the search or choose All records.'
      : 'No events yet. Changes to users, roles, menus, and to-dos will appear here.'

  return (
    <AdminPage
      title="Audit log"
      description="A record of who changed users, roles, permissions, menus, and to-dos. Use it to check a change after it happens."
      actions={
        can('audit.export') && (
          <Button variant="secondary" onClick={exportCsv} disabled={exporting} aria-busy={exporting}>
            {exporting ? 'Exporting…' : 'Export CSV'}
          </Button>
        )
      }
    >
      <Card>
        <div className="mb-4 grid gap-3 rounded-2xl border border-line bg-indigo-soft p-4 sm:grid-cols-2">
          <Select
            label="Record type"
            value={filters.resource_type}
            onChange={(event) => {
              setCursorStack([null])
              setFilters((current) => ({ ...current, resource_type: event.target.value }))
            }}
          >
            <option value="">All records</option>
            {RESOURCE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
          <Input
            label="Search events"
            placeholder="Action, object, or person"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </div>

        {audit.isLoading ? (
          <Spinner label="Loading audit events…" />
        ) : (
          <>
            <DataTable columns={columns} rows={audit.data?.results || []} emptyMessage={emptyMessage} />
            <div className="mt-3 flex items-center justify-end gap-2 text-sm">
              <Button
                variant="outline"
                disabled={cursorStack.length <= 1}
                onClick={() => setCursorStack((s) => s.slice(0, -1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                disabled={!audit.data?.next}
                onClick={() => setCursorStack((s) => [...s, cursorFrom(audit.data.next)])}
              >
                Next
              </Button>
            </div>
          </>
        )}
      </Card>
    </AdminPage>
  )
}

export default AuditPage
