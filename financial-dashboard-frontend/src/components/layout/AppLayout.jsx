// src/components/layout/AppLayout.jsx
import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../../features/auth/AuthProvider'
import { useAccess } from '../../features/auth/useAccess'
import { Button } from '../common/Ui'

const DESKTOP_QUERY = '(min-width: 1024px)'

const navClass = ({ isActive }) =>
  `block rounded-[10px] px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
    isActive ? 'nav-active' : 'text-[#C7D2FE] hover:bg-white/10 hover:text-white'
  }`

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

const findPageName = (menus, pathname) => {
  for (const menu of menus) {
    if (menu.path === pathname) return menu.label
    const child = menu.children?.find((item) => item.path === pathname)
    if (child) return child.label
  }
  return 'Financial Analytics'
}

const NavMenu = ({ menus, onNavigate }) => (
  <nav className="space-y-4">
    {menus.map((menu) => (
      <div key={menu.code} className="space-y-1">
        <NavLink to={menu.path} className={navClass} end onClick={onNavigate}>
          {menu.label}
        </NavLink>
        {menu.children?.map((child) => (
          <NavLink
            key={child.code}
            to={child.path}
            className={({ isActive }) => `${navClass({ isActive })} ml-3`}
            onClick={onNavigate}
          >
            {child.label}
          </NavLink>
        ))}
      </div>
    ))}
  </nav>
)

const AppLayout = () => {
  const { user, logout } = useAuth()
  const { data } = useAccess()
  const navigate = useNavigate()
  const location = useLocation()
  const menus = data?.menus || []
  const pageName = findPageName(menus, location.pathname)
  const drawerId = useId()
  const openerRef = useRef(null)
  const closeRef = useRef(null)
  const drawerRef = useRef(null)
  const contentRef = useRef(null)
  const openRef = useRef(false)
  const savedBackground = useRef({ body: '', root: '', inert: false })
  const [isDrawer, setIsDrawer] = useState(
    () => typeof window !== 'undefined' && !window.matchMedia(DESKTOP_QUERY).matches
  )
  const [open, setOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const releaseBackground = useCallback(() => {
    document.body.style.overflow = savedBackground.current.body
    document.documentElement.style.overflow = savedBackground.current.root
    const content = contentRef.current
    if (!content) return
    if (savedBackground.current.inert) content.setAttribute('inert', '')
    else content.removeAttribute('inert')
  }, [])

  const closeDrawer = useCallback(
    (restoreFocus) => {
      if (!openRef.current) return
      openRef.current = false
      releaseBackground()
      setOpen(false)
      if (!restoreFocus) return
      const opener = openerRef.current
      if (opener?.isConnected) {
        opener.focus()
        return
      }
      document.getElementById('current-page')?.focus()
    },
    [releaseBackground]
  )

  const openDrawer = () => {
    if (openRef.current || !isDrawer) return
    const content = contentRef.current
    savedBackground.current = {
      body: document.body.style.overflow,
      root: document.documentElement.style.overflow,
      inert: content?.hasAttribute('inert') ?? false,
    }
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    content?.setAttribute('inert', '')
    openRef.current = true
    setOpen(true)
  }

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_QUERY)
    const apply = () => {
      setIsDrawer(!media.matches)
      if (media.matches) closeDrawer(false)
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [closeDrawer])

  useEffect(() => {
    closeDrawer(false)
  }, [location.pathname, closeDrawer])

  useEffect(() => {
    if (!open) return undefined
    closeRef.current?.focus()
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeDrawer(true)
        return
      }
      if (event.key !== 'Tab') return
      const root = drawerRef.current
      if (!root) return
      const items = [...root.querySelectorAll(focusableSelector)].filter(
        (element) => element.getClientRects().length > 0
      )
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, closeDrawer])

  useEffect(() => releaseBackground, [releaseBackground])

  return (
    <div className="flex min-h-screen min-w-0 overflow-x-clip bg-canvas">
      <aside className="app-sidebar hidden w-64 shrink-0 p-4 text-white min-[1024px]:block">
        <div className="mb-8 flex items-center gap-3">
          <span className="btn-primary flex h-9 w-9 items-center justify-center rounded-xl text-sm font-semibold" aria-hidden="true">FA</span>
          <h1 className="text-base font-semibold leading-tight tracking-tight">Financial Analytics</h1>
        </div>
        <NavMenu menus={menus} />
      </aside>
      {isDrawer && open && (
        <div className="fixed inset-0 z-50 min-[1024px]:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => closeDrawer(true)} />
          <aside
            ref={drawerRef}
            id={drawerId}
            role="dialog"
            aria-modal="true"
            aria-label="Main navigation"
            tabIndex={-1}
            className="app-sidebar relative flex h-full w-64 flex-col overflow-y-auto p-4 text-white focus-visible:outline-none"
          >
            <div className="mb-8 flex items-start justify-between gap-2">
              <h1 className="text-base font-semibold leading-tight tracking-tight">Financial Analytics</h1>
              <button
                ref={closeRef}
                type="button"
                aria-label="Close menu"
                onClick={() => closeDrawer(true)}
                className="shrink-0 cursor-pointer rounded-[10px] px-2 py-1 text-sm text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                Close
              </button>
            </div>
            <NavMenu menus={menus} onNavigate={() => closeDrawer(true)} />
          </aside>
        </div>
      )}
      <div ref={contentRef} className="flex min-w-0 flex-1 flex-col">
        <header className="flex max-w-full flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-surface px-4 py-3 shadow-[0_10px_30px_-24px_rgba(23,23,47,0.55)] min-[1024px]:px-6">
          <div className="flex min-w-0 basis-full items-center gap-2 sm:basis-auto sm:flex-1">
            <button
              ref={openerRef}
              type="button"
              aria-label="Open menu"
              aria-expanded={open}
              aria-controls={drawerId}
              onClick={openDrawer}
              className="shrink-0 cursor-pointer rounded-[10px] border border-line bg-surface px-2.5 py-1.5 text-sm font-semibold text-ink hover:bg-indigo-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 min-[1024px]:hidden"
            >
              Menu
            </button>
            <p
              id="current-page"
              tabIndex={-1}
              className="min-w-0 truncate text-lg font-semibold tracking-tight text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {pageName}
            </p>
          </div>
          <div className="flex min-w-0 basis-full items-center gap-2 sm:basis-auto">
            <span className="min-w-0 flex-1 truncate text-sm text-ink-secondary sm:flex-none">
              Signed in as <span className="font-medium">{user?.username}</span>
              {user?.is_protected_admin ? ' (protected admin)' : ''}
            </span>
            <Button variant="outline" className="shrink-0" onClick={handleLogout}>
              Log out
            </Button>
          </div>
        </header>
        <main className="min-w-0 flex-1 overflow-x-clip p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default AppLayout
