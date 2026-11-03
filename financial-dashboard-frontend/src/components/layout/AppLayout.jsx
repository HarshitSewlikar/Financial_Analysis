// src/components/layout/AppLayout.jsx
import React from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'

import { useAuth } from '../../features/auth/AuthProvider'
import { useAccess } from '../../features/auth/useAccess'
import { Button } from '../common/Ui'

const navClass = ({ isActive }) =>
  `block rounded-md px-3 py-2 text-sm ${
    isActive ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800/60'
  }`

const AppLayout = () => {
  const { user, logout } = useAuth()
  const { data } = useAccess()
  const navigate = useNavigate()
  const menus = data?.menus || []

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      <aside className="w-64 shrink-0 bg-slate-900 p-4 text-slate-100">
        <h1 className="mb-6 text-lg font-semibold">Financial Analytics</h1>
        <nav className="space-y-1">
          {menus.map((menu) => (
            <div key={menu.code}>
              <NavLink to={menu.path} className={navClass} end>
                {menu.label}
              </NavLink>
              {menu.children?.map((child) => (
                <NavLink
                  key={child.code}
                  to={child.path}
                  className={({ isActive }) =>
                    `${navClass({ isActive })} ml-3`
                  }
                >
                  {child.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
          <span className="text-sm text-slate-600">
            Signed in as <span className="font-medium">{user?.username}</span>
            {user?.is_protected_admin ? ' (protected admin)' : ''}
          </span>
          <Button variant="secondary" onClick={handleLogout}>
            Log out
          </Button>
        </header>
        <main className="min-w-0 flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default AppLayout
