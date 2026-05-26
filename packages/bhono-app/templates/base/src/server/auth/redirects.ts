import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import type { HonoEnv } from '../types'

const MAX_RETURN_TO_LENGTH = 2048

interface AuthState {
  returnTo?: unknown
}

function decodeUriComponent(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function decodeReturnTo(value: string): string {
  let decoded = value
  for (let i = 0; i < 2; i += 1) {
    const next = decodeUriComponent(decoded)
    if (next === decoded) break
    decoded = next
  }
  return decoded
}

function decodeBase64Url(value: string): string {
  const padded = value + '=='.slice(0, (4 - (value.length % 4)) % 4)
  const base64 = padded.replaceAll('-', '+').replaceAll('_', '/')
  const binary = atob(base64)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function hasControlChars(value: string): boolean {
  for (const char of value) {
    const code = char.charCodeAt(0)
    if (code <= 31 || code === 127) return true
  }
  return false
}

function parseStateReturnTo(state: string | null): string | null {
  if (!state) return null

  try {
    const parsed: unknown = JSON.parse(decodeBase64Url(state))
    if (typeof parsed !== 'object' || parsed === null) return null

    const returnTo = (parsed as AuthState).returnTo
    return typeof returnTo === 'string' ? returnTo : null
  } catch {
    return null
  }
}

export function isSafeAuthReturnTo(returnTo: string | null | undefined): boolean {
  if (!returnTo) return true
  if (returnTo.length > MAX_RETURN_TO_LENGTH) return false

  const decoded = decodeReturnTo(returnTo).trim()
  if (!decoded.startsWith('/')) return false
  if (decoded.startsWith('//')) return false
  if (decoded.includes('\\')) return false
  if (hasControlChars(decoded)) return false

  return true
}

export function requireSafeAuthRedirects() {
  return createMiddleware<HonoEnv>(async (c, next) => {
    if (c.req.path === '/auth/login') {
      const returnTo = new URL(c.req.url).searchParams.get('returnTo')
      if (!isSafeAuthReturnTo(returnTo)) {
        throw new HTTPException(400, { message: 'Unsafe auth returnTo redirect' })
      }
    }

    if (c.req.path === '/auth/callback') {
      const state = new URL(c.req.url).searchParams.get('state')
      const returnTo = parseStateReturnTo(state)
      if (!isSafeAuthReturnTo(returnTo)) {
        throw new HTTPException(400, { message: 'Unsafe auth callback redirect' })
      }
    }

    await next()
  })
}
