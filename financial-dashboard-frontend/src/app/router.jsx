// src/app/router.jsx
import React, { Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import AppLayout from '../components/layout/AppLayout'
import { ErrorState, Spinner } from '../components/common/Ui'
import { flattenMenus, resolveComponent } from './componentRegistry'
import { useAuth } from '../features/auth/AuthProvider'
import { useAccess } from '../features/auth/useAccess'
import LoginPage from '../features/auth/LoginPage'
import BootstrapPage from '../features/auth/BootstrapPage'

const FullScreen = ({ children }) => (
  <div className="flex min-h-screen items-center justify-center p-6">{children}</div>
)

const RegistryComponent = ({ componentKey }) => {
  const Component = resolveComponent(componentKey)
  if (!Component) {
    return (
      <ErrorState
        message={`Unknown component key "${componentKey}". Update the component registry to add it.`}
      />
    )
  }
  return (
    <Suspense fallback={<Spinner />}>
      <Component />
    </Suspense>
  )
}

const NotFound = () => <ErrorState message="Page not found or you do not have access." />

export const AppRoutes = () => {
  const { status, isAuthenticated, setupComplete } = useAuth()
  const access = useAccess()

  if (status === 'loading' || setupComplete === null) {
    return (
      <FullScreen>
        <Spinner label="Starting up…" />
      </FullScreen>
    )
  }

  if (setupComplete === false) {
    return (
      <Routes>
        <Route path="*" element={<BootstrapPage />} />
      </Routes>
    )
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  if (access.isLoading) {
    return (
      <FullScreen>
        <Spinner label="Loading workspace…" />
      </FullScreen>
    )
  }

  if (access.isError) {
    return (
      <FullScreen>
        <ErrorState message="Failed to load your access profile." />
      </FullScreen>
    )
  }

  const menuRoutes = flattenMenus(access.data?.menus || []).filter((m) => m.component_key)
  const firstPath = menuRoutes[0]?.path || '/dashboard'

  return (
    <Routes>
      <Route element={<AppLayout />}>
        {menuRoutes.map((menu) => (
          <Route
            key={menu.code}
            path={menu.path}
            element={<RegistryComponent componentKey={menu.component_key} />}
          />
        ))}
        <Route path="/" element={<Navigate to={firstPath} replace />} />
        <Route path="/login" element={<Navigate to={firstPath} replace />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
