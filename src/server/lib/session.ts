// src/server/lib/session.ts
import type { Context, MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'
import { getConnInfo } from 'hono/cloudflare-workers'
import { serialize as serializeCookie } from 'hono/utils/cookie'
import type { Env } from '../env'

/**
 * Session data stored in KV
 */
export interface SessionData {
  userId: string
  email: string
  name: string
  avatarUrl?: string | null
  isSuperAdmin: boolean
  fingerprint?: {
    ip?: string
    userAgent?: string
  }
}

/**
 * Session variables added to Hono context
 */
export interface SessionVars {
  sessionId?: string
  sessionData?: SessionData
  sessionCookies?: string[]
}

/**
 * Session configuration options
 */
export interface SessionOptions {
  cookieName?: string
  ttlSeconds?: number
  sliding?: boolean
  keyPrefix?: string
  cookie?: {
    path?: string
    domain?: string
    secure?: boolean
    httpOnly?: boolean
    sameSite?: 'lax' | 'strict' | 'none'
  }
}

/**
 * Generate a cryptographically secure random session ID
 */
function generateSessionId(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}

/**
 * Extract fingerprint data from request for session binding
 */
function extractFingerprint(c: Context): { ip?: string; userAgent?: string } {
  let ip: string | undefined

  try {
    const connInfo = getConnInfo(c)
    ip = connInfo.remote.address
  } catch {
    // Ignore connection info errors in test/mocked contexts
  }

  const userAgent = c.req.header('user-agent') ?? undefined

  return { ip, userAgent }
}

/**
 * Validate session fingerprint to detect potential session hijacking
 */
function isFingerprintValid(
  stored?: { ip?: string; userAgent?: string },
  current?: { ip?: string; userAgent?: string }
): boolean {
  if (!stored || !current) return true

  // User-Agent should never change for the same session
  if (stored.userAgent && current.userAgent && stored.userAgent !== current.userAgent) {
    return false
  }

  return true
}

/**
 * Session middleware: reads session from KV, sets context variables
 */
export function sessionMiddleware(opts?: SessionOptions): MiddlewareHandler {
  return async (c, next) => {
    const isSecure = new URL(c.req.url).protocol === 'https:'

    const {
      cookieName = isSecure ? '__Host-sid' : 'sid',
      ttlSeconds = 60 * 60 * 24, // 24 hours
      sliding = true,
      keyPrefix = 'sid:',
    } = opts ?? {}

    // Try to read session cookie
    const sid = getCookie(c, cookieName) ?? getCookie(c, isSecure ? 'sid' : '__Host-sid')
    const store = (c.env as Env).SESSIONS

    if (sid && store) {
      const key = `${keyPrefix}${sid}`
      const raw = await store.get(key)

      if (raw) {
        try {
          const data = JSON.parse(raw) as SessionData

          // Validate fingerprint
          const currentFingerprint = extractFingerprint(c)
          if (!isFingerprintValid(data.fingerprint, currentFingerprint)) {
            console.warn('[SECURITY] Session fingerprint mismatch', { sessionId: sid })
            await store.delete(key)
            // Clear cookie
            const serializedCookie = serializeCookie(cookieName, '', {
              path: '/',
              secure: isSecure,
              httpOnly: true,
              expires: new Date(0),
              sameSite: 'lax',
            })
            c.header('Set-Cookie', serializedCookie)
            await next()
            return
          }

          c.set('sessionId', sid)
          c.set('sessionData', data)

          // Sliding expiration
          if (sliding) {
            await store.put(key, raw, { expirationTtl: ttlSeconds })
          }
        } catch {
          // Invalid JSON in KV - ignore
        }
      }
    }

    c.set('sessionCookies', c.get('sessionCookies') ?? [])
    await next()

    // Apply any cookies set during request
    const cookieJar = c.get('sessionCookies') as string[] | undefined
    if (cookieJar?.length) {
      for (const cookie of cookieJar) {
        c.header('Set-Cookie', cookie, { append: true })
      }
    }
  }
}

/**
 * Create a new session: generates SID, stores in KV, sets cookie
 */
export async function createSession(
  c: Context,
  data: Omit<SessionData, 'fingerprint'>,
  opts?: SessionOptions
): Promise<string> {
  const isSecure = new URL(c.req.url).protocol === 'https:'

  const {
    cookieName = isSecure ? '__Host-sid' : 'sid',
    ttlSeconds = 60 * 60 * 24,
    keyPrefix = 'sid:',
    cookie = {},
  } = opts ?? {}

  const sid = generateSessionId()
  const store = (c.env as Env).SESSIONS

  // Add fingerprint to session data
  const fingerprint = extractFingerprint(c)
  const dataWithFingerprint: SessionData = { ...data, fingerprint }

  if (store) {
    const key = `${keyPrefix}${sid}`
    await store.put(key, JSON.stringify(dataWithFingerprint), {
      expirationTtl: ttlSeconds,
    })
  }

  // Serialize and set cookie
  const useHostPrefix = cookieName.startsWith('__Host-')
  const serializedCookie = serializeCookie(cookieName, sid, {
    path: '/',
    domain: useHostPrefix ? undefined : cookie.domain,
    secure: useHostPrefix ? true : isSecure,
    httpOnly: cookie.httpOnly ?? true,
    sameSite: (cookie.sameSite ?? 'lax'),
  })

  const cookieJar = (c.get('sessionCookies') as string[] | undefined) ?? []
  cookieJar.push(serializedCookie)
  c.set('sessionCookies', cookieJar)

  c.set('sessionId', sid)
  c.set('sessionData', dataWithFingerprint)

  return sid
}

/**
 * Destroy session: removes from KV and clears cookie
 */
export async function destroySession(c: Context, opts?: SessionOptions): Promise<void> {
  const isSecure = new URL(c.req.url).protocol === 'https:'

  const {
    cookieName = isSecure ? '__Host-sid' : 'sid',
    keyPrefix = 'sid:',
    cookie = {},
  } = opts ?? {}

  const sid = (c.get('sessionId') as string | undefined) ?? getCookie(c, cookieName)
  const store = (c.env as Env).SESSIONS

  if (sid && store) {
    await store.delete(`${keyPrefix}${sid}`)
  }

  // Clear cookie
  const useHostPrefix = cookieName.startsWith('__Host-')
  const serializedCookie = serializeCookie(cookieName, '', {
    path: '/',
    domain: useHostPrefix ? undefined : cookie.domain,
    secure: useHostPrefix ? true : isSecure,
    httpOnly: cookie.httpOnly ?? true,
    expires: new Date(0),
    sameSite: (cookie.sameSite ?? 'lax'),
  })

  const cookieJar = (c.get('sessionCookies') as string[] | undefined) ?? []
  cookieJar.push(serializedCookie)
  c.set('sessionCookies', cookieJar)

  c.set('sessionId', undefined)
  c.set('sessionData', undefined)
}

/**
 * Update session data: merges new data with existing session
 */
export async function updateSession(
  c: Context,
  updates: Partial<SessionData>,
  opts?: SessionOptions
): Promise<void> {
  const {
    ttlSeconds = 60 * 60 * 24,
    keyPrefix = 'sid:',
  } = opts ?? {}

  const sid = c.get('sessionId') as string | undefined
  const store = (c.env as Env).SESSIONS
  const currentData = c.get('sessionData') as SessionData | undefined

  if (!sid || !store || !currentData) {
    throw new Error('No active session to update')
  }

  // Merge updates with existing data
  const updatedData: SessionData = { ...currentData, ...updates }

  // Store updated session
  const key = `${keyPrefix}${sid}`
  await store.put(key, JSON.stringify(updatedData), {
    expirationTtl: ttlSeconds,
  })

  // Update context
  c.set('sessionData', updatedData)
}

/**
 * Get current session data from context
 */
export function getSession(c: Context): SessionData | null {
  return (c.get('sessionData') as SessionData | undefined) ?? null
}

/**
 * Check if user is authenticated (has valid session)
 */
export function isAuthenticated(c: Context): boolean {
  return !!c.get('sessionData')
}
