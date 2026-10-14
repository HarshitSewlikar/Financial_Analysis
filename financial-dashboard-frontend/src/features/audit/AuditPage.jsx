// src/features/audit/AuditPage.jsx
import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '../../app/queryClient'
import { Button, Card, DataTable, Input, Select, Spinner } from '../../components/common/Ui'
import { http } from '../../services/http'
import { listAudit } from '../../services/endpoints'
import { usePermission } from '../auth/useAccess'

const RESOURCE_TYPES = ['User', 'Role', 'Permission', 'Menu', 'Todo']

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
  const [cursorStack, setCursorStack] = useState([null])
  const cursor = cursorStack[cursorStack.length - 1]

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
  }

  const columns = [
    {
      header: 'When',
      render: (r) => new Date(r.created_at).toLocaleString(),
    },
    { header: 'Actor', render: (r) => r.actor_username || '—' },
    { header: 'Action', key: 'action' },
    { header: 'Resource', key: 'resource_type' },
    { header: 'Object', render: (r) => r.object_id || '—' },
    { header: 'IP', render: (r) => r.ip_address || '—' },
  ]

  return (
    <div className="space-y-4">
      <Card
        title="Audit log"
        actions={
          can('audit.export') && (
            <Button variant="secondary" onClick={exportCsv}>
              Export CSV
            </Button>
          )
        }
      >
        <div className="mb-3 flex flex-wrap gap-3">
          <Select
            value={filters.resource_type}
            onChange={(e) => {
              setCursorStack([null])
              setFilters((p) => ({ ...p, resource_type: e.target.value }))
            }}
          >
            <option value="">All resources</option>
            {RESOURCE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
          <Input
            placeholder="Search action / object / actor"
            value={filters.search}
            onChange={(e) => {
              setCursorStack([null])
              setFilters((p) => ({ ...p, search: e.target.value }))
            }}
          />
        </div>

        {audit.isLoading ? (
          <Spinner />
        ) : (
          <>
            <DataTable columns={columns} rows={audit.data?.results || []} />
            <div className="mt-3 flex items-center justify-end gap-2 text-sm">
              <Button
                variant="secondary"
                disabled={cursorStack.length <= 1}
                onClick={() => setCursorStack((s) => s.slice(0, -1))}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                disabled={!audit.data?.next}
                onClick={() => setCursorStack((s) => [...s, cursorFrom(audit.data.next)])}
              >
                Next
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}

export default AuditPage
