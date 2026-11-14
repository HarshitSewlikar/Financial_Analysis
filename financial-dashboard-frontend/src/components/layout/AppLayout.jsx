// src/components/layout/AppLayout.jsx
import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../../features/auth/AuthProvider'
import { useAccess } from '../../features/auth/useAccess'
import { Button } from '../common/Ui'

const DESKTOP_QUERY = '(min-width: 1024px)'

const navClass = ({ isActive }) =>
  `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
    isActive ? 'nav-active' : 'text-nav hover:bg-white/10 hover:text-white'
  }`

const NAV_PATHS = {
  dashboard: 'M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z',
  todos: 'M8 7h11M8 12h11M8 17h11M4.5 7h.01M4.5 12h.01M4.5 17h.01',
  users: 'M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM20 19v-1a3.5 3.5 0 0 0-2.5-3.35M16.5 5.1a3 3 0 0 1 0 5.8',
  roles: 'M12 3 5 6v5c0 4.2 2.9 7.4 7 9 4.1-1.6 7-4.8 7-9V6l-7-3Z',
  permissions: 'M8 11V8a4 4 0 1 1 8 0v3M6 11h12v9H6v-9Z',
  audit: 'M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z',
}

const NavIcon = ({ code }) => (
  <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d={NAV_PATHS[code] || NAV_PATHS.dashboard} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const NAV_GROUPS = [
  { id: 'main', label: 'Main', codes: ['dashboard', 'todos'] },
  { id: 'admin', label: 'Admin', codes: ['users', 'roles', 'permissions', 'audit'] },
]

const groupMenus = (menus) => {
  const used = new Set()
  const groups = NAV_GROUPS.map((group) => {
    const items = group.codes
      .map((code) => menus.find((menu) => menu.code === code))
      .filter(Boolean)
    items.forEach((item) => used.add(item.code))
    return { ...group, items }
  }).filter((group) => group.items.length)
  const rest = menus.filter((menu) => !used.has(menu.code))
  if (rest.length) groups.push({ id: 'more', label: 'More', items: rest })
  return groups
}

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

const BrandMark = ({ onNavigate }) => (
  <Link
    to="/dashboard"
    onClick={onNavigate}
    className="flex min-w-0 items-center gap-3 rounded-xl text-white no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
  >
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-nav-active text-white" aria-hidden="true">
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 19V5M4 19h16" strokeLinecap="round" />
        <path d="M8 15l3.2-3.2 2.3 2.2L19 8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
    <span className="text-[15px] font-semibold leading-tight tracking-tight">Financial Analytics</span>
  </Link>
)

const QueryLink = ({ onNavigate }) => (
  <NavLink to="/queries" className={navClass} onClick={onNavigate}>
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path
        d="M21 11.5a8.4 8.4 0 0 1-8.5 8.4 8.4 8.4 0 0 1-3.8-.9L3 20.5l1.5-4.2A8.4 8.4 0 1 1 21 11.5Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
    Submit a Request
  </NavLink>
)

const NavMenu = ({ menus, onNavigate }) => (
  <nav className="space-y-6">
    {groupMenus(menus).map((group) => (
      <div key={group.id} className="space-y-1">
        <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
          {group.label}
        </p>
        {group.items.map((menu) => (
          <div key={menu.code} className="space-y-1">
            <NavLink to={menu.path} className={navClass} end onClick={onNavigate}>
              <NavIcon code={menu.code} />
              {menu.label}
            </NavLink>
            {menu.children?.map((child) => (
              <NavLink
                key={child.code}
                to={child.path}
                className={({ isActive }) => `${navClass({ isActive })} ml-6`}
                onClick={onNavigate}
              >
                <NavIcon code={child.code} />
                {child.label}
              </NavLink>
            ))}
          </div>
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
  const pageName =
    location.pathname === '/queries' ? 'Submit a Query' : findPageName(menus, location.pathname)
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
    <div className="flex min-h-screen min-w-0 bg-canvas">
      <aside className="app-sidebar sticky top-0 hidden h-screen w-64 shrink-0 flex-col self-start overflow-y-auto p-4 text-white min-[1024px]:flex">
        <h1 className="mb-8">
          <BrandMark />
        </h1>
        <div className="min-h-0 flex-1">
          <NavMenu menus={menus} />
        </div>
        <div className="mt-6 border-t border-white/15 pt-4">
          <QueryLink />
        </div>
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
              <h1 className="min-w-0">
                <BrandMark onNavigate={() => closeDrawer(true)} />
              </h1>
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
            <div className="min-h-0 flex-1">
              <NavMenu menus={menus} onNavigate={() => closeDrawer(true)} />
            </div>
            <div className="mt-6 border-t border-white/15 pt-4">
              <QueryLink onNavigate={() => closeDrawer(true)} />
            </div>
          </aside>
        </div>
      )}
      <div ref={contentRef} className="flex min-w-0 flex-1 flex-col">
        <header className="flex max-w-full flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3 min-[1024px]:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              ref={openerRef}
              type="button"
              aria-label="Open menu"
              aria-expanded={open}
              aria-controls={drawerId}
              onClick={openDrawer}
              className="shrink-0 cursor-pointer rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm font-semibold text-ink hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 min-[1024px]:hidden"
            >
              Menu
            </button>
            <p id="current-page" tabIndex={-1} className="sr-only">
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
        <main className="min-w-0 flex-1 overflow-x-clip px-4 pb-4 pt-1 min-[1024px]:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default AppLayout
