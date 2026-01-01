// src/client/hooks/use-auth.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { AuthUser } from '@shared/types'

interface AuthResponse {
  user: AuthUser
}

async function fetchMe(): Promise<AuthResponse | null> {
  const res = await fetch('/auth/me', { credentials: 'include' })
  if (!res.ok) return null
  return res.json()
}

async function logout(): Promise<void> {
  const res = await fetch('/auth/logout', { method: 'POST', credentials: 'include' })
  if (!res.ok) {
    throw new Error('Failed to logout')
  }
}

export function useAuth() {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchMe,
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(['auth', 'me'], null)
      toast.success('Logged out successfully')
    },
    onError: () => {
      toast.error('Failed to logout. Please try again.')
    },
  })

  return {
    user: data?.user ?? null,
    isLoading,
    isAuthenticated: !!data?.user,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  }
}
