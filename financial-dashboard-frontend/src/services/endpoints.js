// src/services/endpoints.js
import { http } from './http'

// --- Auth ---
export const getSetupStatus = () => http.get('/auth/setup-status/').then((r) => r.data)
export const bootstrap = (payload) =>
  http.post('/auth/bootstrap/', payload).then((r) => r.data)
export const login = (payload) => http.post('/auth/login/', payload).then((r) => r.data)
export const logout = () => http.post('/auth/logout/').then((r) => r.data)
export const getMe = () => http.get('/auth/me/').then((r) => r.data)
export const getAccess = () => http.get('/auth/me/access/').then((r) => r.data)

// --- Users ---
export const listUsers = (params = {}) =>
  http.get('/users/', { params }).then((r) => r.data)
export const createUser = (payload) => http.post('/users/', payload).then((r) => r.data)
export const updateUser = (id, payload) =>
  http.patch(`/users/${id}/`, payload).then((r) => r.data)
export const deactivateUser = (id) => http.delete(`/users/${id}/`)
export const getUserRoles = (id) =>
  http.get(`/users/${id}/roles/`).then((r) => r.data)
export const setUserRoles = (id, roleIds) =>
  http.put(`/users/${id}/roles/`, { role_ids: roleIds }).then((r) => r.data)
export const getUserOverrides = (id) =>
  http.get(`/users/${id}/permission-overrides/`).then((r) => r.data)
export const setUserOverrides = (id, overrides) =>
  http.put(`/users/${id}/permission-overrides/`, { overrides }).then((r) => r.data)

// --- Roles ---
export const listRoles = (params = {}) =>
  http.get('/roles/', { params }).then((r) => r.data)
export const createRole = (payload) => http.post('/roles/', payload).then((r) => r.data)
export const updateRole = (id, payload) =>
  http.patch(`/roles/${id}/`, payload).then((r) => r.data)
export const deactivateRole = (id) => http.delete(`/roles/${id}/`)
export const getRolePermissions = (id) =>
  http.get(`/roles/${id}/permissions/`).then((r) => r.data)
export const setRolePermissions = (id, codes) =>
  http.put(`/roles/${id}/permissions/`, { permission_codes: codes }).then((r) => r.data)
export const getRoleMenus = (id) =>
  http.get(`/roles/${id}/menus/`).then((r) => r.data)
export const setRoleMenus = (id, menuIds) =>
  http.put(`/roles/${id}/menus/`, { menu_ids: menuIds }).then((r) => r.data)

// --- Permissions ---
export const listPermissions = (params = {}) =>
  http.get('/permissions/', { params }).then((r) => r.data)
export const createPermission = (payload) =>
  http.post('/permissions/', payload).then((r) => r.data)
export const updatePermission = (id, payload) =>
  http.patch(`/permissions/${id}/`, payload).then((r) => r.data)
export const deactivatePermission = (id) => http.delete(`/permissions/${id}/`)

// --- Menus ---
export const listMenus = (params = {}) =>
  http.get('/menus/', { params }).then((r) => r.data)
export const createMenu = (payload) => http.post('/menus/', payload).then((r) => r.data)
export const updateMenu = (id, payload) =>
  http.patch(`/menus/${id}/`, payload).then((r) => r.data)
export const deactivateMenu = (id) => http.delete(`/menus/${id}/`)
export const getNavigationMenus = () =>
  http.get('/navigation/menus/').then((r) => r.data)

// --- Todos ---
export const listTodos = (params = {}) =>
  http.get('/todos/', { params }).then((r) => r.data)
export const createTodo = (payload) => http.post('/todos/', payload).then((r) => r.data)
export const updateTodo = (id, payload) =>
  http.patch(`/todos/${id}/`, payload).then((r) => r.data)
export const deleteTodo = (id) => http.delete(`/todos/${id}/`)
export const assignTodo = (id, assignee) =>
  http.post(`/todos/${id}/assign/`, { assignee }).then((r) => r.data)
export const setTodoStatus = (id, status) =>
  http.post(`/todos/${id}/status/`, { status }).then((r) => r.data)

// --- Audit ---
export const listAudit = (params = {}) =>
  http.get('/audit-logs/', { params }).then((r) => r.data)
export const auditExportUrl = `${http.defaults.baseURL}/audit-logs/export/`

// --- Market ---
export const getDailyStock = (symbol) =>
  http.get(`/market/stock-daily/${symbol}/`).then((r) => ({
    data: r.data,
    source: r.headers['x-data-source'] || 'live',
  }))
export const getSectors = () =>
  http.get('/market/sector-performance/').then((r) => ({
    data: r.data,
    source: r.headers['x-data-source'] || 'live',
  }))
export const getMovers = () =>
  http.get('/market/movers/').then((r) => ({
    data: r.data,
    source: r.headers['x-data-source'] || 'live',
  }))
export const getStockScore = (symbol) =>
  http.get(`/market/stock-score/${symbol}/`).then((r) => ({
    data: r.data,
    source: r.headers['x-data-source'] || 'live',
  }))
