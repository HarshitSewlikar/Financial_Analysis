// src/services/http.js
import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1'

// Access token lives in memory only (never localStorage/sessionStorage).
let accessToken = null
let authLostHandler = null

export const setAccessToken = (token) => {
  accessToken = token || null
}

export const getAccessToken = () => accessToken

export const setAuthLostHandler = (handler) => {
  authLostHandler = handler
}

const getCookie = (name) => {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  return match ? decodeURIComponent(match[1]) : null
}

export const http = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

http.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  if (config.method && config.method.toLowerCase() !== 'get') {
    const csrf = getCookie('csrftoken')
    if (csrf) config.headers['X-CSRFToken'] = csrf
  }
  return config
})

let refreshPromise = null

const performRefresh = async () => {
  const csrf = getCookie('csrftoken')
  const response = await axios.post(
    `${BASE_URL}/auth/token/refresh/`,
    {},
    { withCredentials: true, headers: csrf ? { 'X-CSRFToken': csrf } : {} }
  )
  const token = response.data.access
  setAccessToken(token)
  return token
}

// De-duplicate concurrent refresh attempts (e.g. React StrictMode double-mount).
const runRefresh = () => {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

http.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { response, config } = error
    const status = response?.status
    const isRefreshCall = config?.url?.includes('/auth/token/refresh/')

    if (status === 401 && config && !config._retried && !isRefreshCall) {
      config._retried = true
      try {
        await runRefresh()
        return http(config)
      } catch (refreshError) {
        setAccessToken(null)
        if (authLostHandler) authLostHandler()
        return Promise.reject(refreshError)
      }
    }
    return Promise.reject(error)
  }
)

export const ensureCsrfCookie = () => http.get('/auth/csrf/')

export const refreshAccessToken = () => runRefresh()

export const extractError = (error) => {
  const data = error?.response?.data
  const detail = data?.error?.detail ?? data?.detail

  if (detail && typeof detail === 'object') {
    return Object.entries(detail)
      .map(([field, messages]) => {
        const text = Array.isArray(messages) ? messages.join(' ') : String(messages)
        return field === 'non_field_errors' ? text : `${field}: ${text}`
      })
      .join(' ')
  }
  if (typeof detail === 'string') return detail
  return error?.message || 'Request failed'
}
