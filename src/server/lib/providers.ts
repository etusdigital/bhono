// src/server/lib/providers.ts

export const SUPPORTED_PROVIDERS = ['google', 'github', 'microsoft', 'email'] as const

export type Provider = (typeof SUPPORTED_PROVIDERS)[number]

export interface ParsedProviderId {
  provider: Provider
  id: string
}

/**
 * Check if a provider ID exists in the array
 */
export function hasProvider(providerIds: string[], providerId: string): boolean {
  return providerIds.includes(providerId)
}

/**
 * Add a provider ID to the array (immutable, no duplicates)
 */
export function addProvider(providerIds: string[], providerId: string): string[] {
  if (hasProvider(providerIds, providerId)) {
    return providerIds
  }
  return [...providerIds, providerId]
}

/**
 * Remove a provider ID from the array (immutable)
 */
export function removeProvider(providerIds: string[], providerId: string): string[] {
  return providerIds.filter((id) => id !== providerId)
}

/**
 * Parse a provider ID string into provider type and ID
 * Format: "provider|id" (e.g., "google|abc123")
 * Returns null if format is invalid or provider is unsupported
 */
export function parseProviderId(providerId: string): ParsedProviderId | null {
  if (!providerId) {
    return null
  }

  const separatorIndex = providerId.indexOf('|')
  if (separatorIndex === -1) {
    return null
  }

  const provider = providerId.substring(0, separatorIndex)
  const id = providerId.substring(separatorIndex + 1)

  if (!SUPPORTED_PROVIDERS.includes(provider as Provider)) {
    return null
  }

  return {
    provider: provider as Provider,
    id,
  }
}
