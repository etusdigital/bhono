import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import type { Context } from 'hono'
import type { HonoEnv } from '../types'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * Options for csrfProtection().
 *
 * Each list extends the defaults — it does not replace them. The defaults
 * cover the routes the boilerplate ships with; pass extra entries here when
 * adding new mounted routes that need to opt out of the default contract.
 */
export interface CsrfProtectionOptions {
  /** Paths skipped entirely. Use only for endpoints with their own gate (e.g. dev-login's localhost check). */
  exemptPaths?: Iterable<string>
  /** Exact paths where POST/PUT/PATCH may legitimately send no body. */
  emptyBodyPaths?: Iterable<string>
  /** Regex patterns for the empty-body allowlist (e.g. token-keyed verbs under /invitations). */
  emptyBodyPatterns?: readonly RegExp[]
  /** Path prefixes allowed to use non-JSON content types (e.g. binary uploads, webhooks). */
  nonJsonPathPrefixes?: Iterable<string>
}

const DEFAULT_EXEMPT_PATHS = ['/auth/test-login'] as const
const DEFAULT_EMPTY_BODY_PATHS = ['/auth/logout'] as const
// Accept | decline cover both lifecycle verbs on a token-keyed invitation.
// Add more here (revoke, expire, etc.) only when the matching route exists.
const DEFAULT_EMPTY_BODY_PATTERNS: readonly RegExp[] = [
  /^\/invitations\/[^/]+\/(accept|decline)$/,
]
const DEFAULT_NON_JSON_PATH_PREFIXES = ['/api/storage/upload/'] as const

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

export function csrfProtection(options: CsrfProtectionOptions = {}) {
  const exemptPaths = new Set<string>([
    ...DEFAULT_EXEMPT_PATHS,
    ...(options.exemptPaths ?? []),
  ])
  const emptyBodyPaths = new Set<string>([
    ...DEFAULT_EMPTY_BODY_PATHS,
    ...(options.emptyBodyPaths ?? []),
  ])
  const emptyBodyPatterns: readonly RegExp[] = [
    ...DEFAULT_EMPTY_BODY_PATTERNS,
    ...(options.emptyBodyPatterns ?? []),
  ]
  const nonJsonPathPrefixes: readonly string[] = [
    ...DEFAULT_NON_JSON_PATH_PREFIXES,
    ...(options.nonJsonPathPrefixes ?? []),
  ]

  function allowsEmptyBody(path: string): boolean {
    if (emptyBodyPaths.has(path)) return true
    return emptyBodyPatterns.some((pattern) => pattern.test(path))
  }

  function isNonJsonPath(path: string): boolean {
    return nonJsonPathPrefixes.some((prefix) => path.startsWith(prefix))
  }

  function hasRequiredContentType(c: Context<HonoEnv>): boolean {
    if (!['POST', 'PUT', 'PATCH'].includes(c.req.method)) return true
    if (allowsEmptyBody(c.req.path) || isNonJsonPath(c.req.path)) return true

    const contentType = c.req.header('Content-Type')
    return contentType?.toLowerCase().startsWith('application/json') ?? false
  }

  return createMiddleware<HonoEnv>(async (c, next) => {
    if (SAFE_METHODS.has(c.req.method) || exemptPaths.has(c.req.path)) {
      await next()
      return
    }

    const origin = requestOrigin(c)
    if (!origin || !allowedOrigins(c).has(origin)) {
      throw new HTTPException(403, { message: 'Untrusted request origin' })
    }

    if (!hasRequiredContentType(c)) {
      throw new HTTPException(415, {
        message:
          'State-changing requests must use application/json. ' +
          'Extend csrfProtection({ nonJsonPathPrefixes: [...] }) to opt this route out.',
      })
    }

    await next()
  })
}
