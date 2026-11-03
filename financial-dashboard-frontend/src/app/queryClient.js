import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: true,
      staleTime: 15_000,
    },
    mutations: {
      retry: 0,
    },
  },
})

// Canonical query keys used throughout the app.
export const queryKeys = {
  authMe: ['auth', 'me'],
  authAccess: ['auth', 'access'],
  navigationMenus: ['navigation', 'menus'],
  users: (filters) => ['users', filters],
  roles: (filters) => ['roles', filters],
  permissions: (filters) => ['permissions', filters],
  menus: (filters) => ['menus', filters],
  audit: (filters) => ['audit', filters],
  todos: (filters) => ['todos', filters],
  todo: (id) => ['todo', id],
  marketDaily: (symbol) => ['market', 'daily', symbol],
  marketMovers: ['market', 'movers'],
  marketSectors: ['market', 'sectors'],
  marketScore: (symbol) => ['market', 'score', symbol],
}
