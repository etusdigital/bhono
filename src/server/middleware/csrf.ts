import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import type { Context } from 'hono'
import type { HonoEnv } from '../types'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const CSRF_EXEMPT_PATHS = new Set(['/auth/test-login'])
const EMPTY_BODY_PATHS = new Set(['/auth/logout'])

function parseList(csv: string | undefined): string[] {
  return (csv ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function normalizeOrigin(value: string): string | null {
  if (value === '*') return null

  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

function allowedOrigins(c: Context<HonoEnv>): Set<string> {
  const origins = [
    c.env.APP_URL,
    new URL(c.req.url).origin,
    ...parseList(c.env.CORS_ORIGINS),
  ]

  return new Set(
    origins
      .map((origin) => normalizeOrigin(origin))
      .filter((origin): origin is string => origin !== null),
  )
}

function requestOrigin(c: Context<HonoEnv>): string | null {
  const origin = c.req.header('Origin')
  if (origin) return normalizeOrigin(origin)

  const referer = c.req.header('Referer')
  return referer ? normalizeOrigin(referer) : null
}

function isStorageUpload(path: string): boolean {
  return path.startsWith('/api/storage/upload/')
}

function allowsEmptyBody(path: string): boolean {
  if (EMPTY_BODY_PATHS.has(path)) return true
  return /^\/invitations\/[^/]+\/accept$/.test(path)
}

function hasRequiredContentType(c: Context<HonoEnv>): boolean {
  if (!['POST', 'PUT', 'PATCH'].includes(c.req.method)) return true
  if (allowsEmptyBody(c.req.path) || isStorageUpload(c.req.path)) return true

  const contentType = c.req.header('Content-Type')
  return contentType?.toLowerCase().startsWith('application/json') ?? false
}

export function csrfProtection() {
  return createMiddleware<HonoEnv>(async (c, next) => {
    if (SAFE_METHODS.has(c.req.method) || CSRF_EXEMPT_PATHS.has(c.req.path)) {
      await next()
      return
    }

    const origin = requestOrigin(c)
    if (!origin || !allowedOrigins(c).has(origin)) {
      throw new HTTPException(403, { message: 'Untrusted request origin' })
    }

    if (!hasRequiredContentType(c)) {
      throw new HTTPException(415, { message: 'State-changing requests must use application/json' })
    }

    await next()
  })
}
