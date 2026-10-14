// src/app/componentRegistry.jsx
import { lazy } from 'react'

// Fixed allowlist. Database component keys may only reference these.
export const COMPONENT_REGISTRY = {
  DashboardPage: lazy(() => import('../features/market/MarketDashboardPage')),
  TodosPage: lazy(() => import('../features/todos/TodosPage')),
  UsersAdminPage: lazy(() => import('../features/users/UsersAdminPage')),
  RolesAdminPage: lazy(() => import('../features/roles/RolesAdminPage')),
  PermissionsAdminPage: lazy(() => import('../features/permissions/PermissionsAdminPage')),
  MenusAdminPage: lazy(() => import('../features/menus/MenusAdminPage')),
  AuditPage: lazy(() => import('../features/audit/AuditPage')),
}

export const resolveComponent = (key) => COMPONENT_REGISTRY[key] || null

export const flattenMenus = (menus) => {
  const flat = []
  const walk = (items) => {
    if (!Array.isArray(items)) return
    items.forEach((item) => {
      flat.push(item)
      if (item.children) walk(item.children)
    })
  }
  walk(menus)
  return flat
}
