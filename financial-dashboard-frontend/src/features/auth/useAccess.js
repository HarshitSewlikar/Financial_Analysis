// src/features/auth/useAccess.js
import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '../../app/queryClient'
import { getAccess } from '../../services/endpoints'
import { useAuth } from './AuthProvider'

export const useAccess = () => {
  const { isAuthenticated } = useAuth()
  return useQuery({
    queryKey: queryKeys.authAccess,
    queryFn: getAccess,
    enabled: isAuthenticated,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  })
}

export const usePermission = () => {
  const { data } = useAccess()
  const permissions = data?.permissions || []
  return (code) => permissions.includes(code)
}
