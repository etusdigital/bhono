// src/client/hooks/use-gateway-accounts.ts
//
// Reads the user's GATEWAY account context from `GET /api/me` (gateway-as-authority,
// @etus/auth v0.9.1): the per-account roles the gateway resolved for the user plus
// the global super-admin flag. This is the org-level dimension the app reads for
// authorization, alongside its own local workspaces. Always resolves to a safe
// shape (empty / false) when gatewayAuthority is disabled.
import { useQuery } from '@tanstack/react-query'

export type AccountRole = 'viewer' | 'editor' | 'manager' | 'admin'

export interface GatewayAccount {
  id: string
  slug: string
  name: string
  role: AccountRole
}

interface GatewayAccountContext {
  accounts: GatewayAccount[]
  superAdmin: boolean
}

// Cumulative hierarchy: viewer < editor < manager < admin (gateway migration 0070).
const ROLE_RANK: Record<AccountRole, number> = { viewer: 0, editor: 1, manager: 2, admin: 3 }

async function fetchGatewayAccounts(): Promise<GatewayAccountContext> {
  const res = await fetch('/api/me', { credentials: 'include' })
  if (!res.ok) return { accounts: [], superAdmin: false }
  return res.json()
}

export function useGatewayAccounts() {
  const { data, isLoading } = useQuery({
    queryKey: ['gateway', 'accounts'],
    queryFn: fetchGatewayAccounts,
    retry: false,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnMount: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  })

  const accounts = data?.accounts ?? []
  const superAdmin = data?.superAdmin ?? false

  return {
    accounts,
    superAdmin,
    isLoading,
    /**
     * True when the user holds at least `role` on the gateway account `slug`
     * (cumulative; a super-admin always passes). Mirrors the server-side
     * `auth.requireGatewayAccountRole` / `hasGatewayAccountRole` — use it to gate
     * UI, NOT as a security boundary (the server guards remain authoritative).
     */
    hasAccountRole(slug: string, role: AccountRole): boolean {
      if (superAdmin) return true
      const membership = accounts.find((a) => a.slug === slug)
      return membership ? ROLE_RANK[membership.role] >= ROLE_RANK[role] : false
    },
  }
}
