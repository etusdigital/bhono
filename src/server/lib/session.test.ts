// src/server/lib/session.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createSession,
  destroySession,
  getSession,
  isAuthenticated,
  sessionMiddleware,
  type SessionData,
} from './session'
import { createMockKV, type MockKVNamespace } from '../__tests__/mocks/kv'

/**
 * Create a mock Hono context for testing session functions
 */
function createMockContext(opts: {
  url?: string
  sessionData?: SessionData
  sessionId?: string
  cookies?: Record<string, string>
  env?: { SESSIONS?: MockKVNamespace }
  userAgent?: string
} = {}) {
  const contextVars = new Map<string, unknown>()
  if (opts.sessionData) contextVars.set('sessionData', opts.sessionData)
  if (opts.sessionId) contextVars.set('sessionId', opts.sessionId)
  contextVars.set('sessionCookies', [])

  const mockKv = opts.env?.SESSIONS ?? createMockKV()

  return {
    req: {
      url: opts.url ?? 'http://localhost:3000/test',
      header: vi.fn().mockImplementation((name: string) => {
        if (name === 'user-agent') return opts.userAgent ?? 'TestAgent/1.0'
        if (name === 'cookie') {
          const cookies = opts.cookies ?? {}
          return Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ')
        }
        return undefined
      }),
    },
    env: { SESSIONS: mockKv },
    get: vi.fn().mockImplementation((key: string) => contextVars.get(key)),
    set: vi.fn().mockImplementation((key: string, value: unknown) => contextVars.set(key, value)),
    header: vi.fn(),
    _contextVars: contextVars,
    _mockKv: mockKv,
  }
}

describe('session library', () => {
  describe('getSession', () => {
    it('should return null when no session data in context', () => {
      const c = createMockContext()

      const result = getSession(c as never)

      expect(result).toBeNull()
    })

    it('should return session data when present in context', () => {
      const sessionData: SessionData = {
        userId: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        isSuperAdmin: false,
      }
      const c = createMockContext({ sessionData })

      const result = getSession(c as never)

      expect(result).toEqual(sessionData)
    })
  })

  describe('isAuthenticated', () => {
    it('should return false when no session data', () => {
      const c = createMockContext()

      const result = isAuthenticated(c as never)

      expect(result).toBe(false)
    })

    it('should return true when session data exists', () => {
      const sessionData: SessionData = {
        userId: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        isSuperAdmin: false,
      }
      const c = createMockContext({ sessionData })

      const result = isAuthenticated(c as never)

      expect(result).toBe(true)
    })
  })

  describe('createSession', () => {
    it('should generate a session ID', async () => {
      const c = createMockContext()
      const sessionData = {
        userId: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        isSuperAdmin: false,
      }

      const sid = await createSession(c as never, sessionData)

      expect(sid).toBeDefined()
      expect(typeof sid).toBe('string')
      expect(sid.length).toBeGreaterThan(0)
    })

    it('should store session data in KV with fingerprint', async () => {
      const c = createMockContext()
      const sessionData = {
        userId: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        isSuperAdmin: false,
      }

      const sid = await createSession(c as never, sessionData)

      // Check KV was called with correct key
      expect(c._mockKv.put).toHaveBeenCalled()
      const putCall = c._mockKv.put.mock.calls[0]
      expect(putCall[0]).toBe(`sid:${sid}`)

      // Check stored data includes fingerprint
      const storedData = JSON.parse(putCall[1])
      expect(storedData.userId).toBe('user-123')
      expect(storedData.email).toBe('test@example.com')
      expect(storedData.fingerprint).toBeDefined()
      expect(storedData.fingerprint.userAgent).toBe('TestAgent/1.0')
    })

    it('should add cookie to sessionCookies', async () => {
      const c = createMockContext()
      const sessionData = {
        userId: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        isSuperAdmin: false,
      }

      const sid = await createSession(c as never, sessionData)

      // Check sessionCookies was updated
      const cookieJar = c._contextVars.get('sessionCookies') as string[]
      expect(cookieJar.length).toBeGreaterThan(0)
      expect(cookieJar[0]).toContain('sid=')
      expect(cookieJar[0]).toContain(sid)
    })

    it('should set sessionId and sessionData in context', async () => {
      const c = createMockContext()
      const sessionData = {
        userId: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        isSuperAdmin: false,
      }

      const sid = await createSession(c as never, sessionData)

      // Check context was updated
      expect(c._contextVars.get('sessionId')).toBe(sid)
      const storedSession = c._contextVars.get('sessionData') as SessionData
      expect(storedSession.userId).toBe('user-123')
      expect(storedSession.fingerprint).toBeDefined()
    })

    it('should use custom options when provided', async () => {
      const c = createMockContext()
      const sessionData = {
        userId: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        isSuperAdmin: false,
      }

      const sid = await createSession(c as never, sessionData, {
        cookieName: 'custom-session',
        keyPrefix: 'custom:',
        ttlSeconds: 3600,
      })

      // Check KV was called with custom prefix
      const putCall = c._mockKv.put.mock.calls[0]
      expect(putCall[0]).toBe(`custom:${sid}`)
      expect(putCall[2]).toEqual({ expirationTtl: 3600 })

      // Check cookie uses custom name
      const cookieJar = c._contextVars.get('sessionCookies') as string[]
      expect(cookieJar[0]).toContain('custom-session=')
    })
  })

  describe('destroySession', () => {
    it('should delete session from KV', async () => {
      const mockKv = createMockKV()
      const sessionId = 'test-session-id'
      // Pre-populate the session in KV
      await mockKv.put(`sid:${sessionId}`, JSON.stringify({ userId: 'user-123' }))

      const c = createMockContext({
        sessionId,
        env: { SESSIONS: mockKv },
      })

      await destroySession(c as never)

      expect(mockKv.delete).toHaveBeenCalledWith(`sid:${sessionId}`)
    })

    it('should clear session cookie', async () => {
      const mockKv = createMockKV()
      const sessionId = 'test-session-id'

      const c = createMockContext({
        sessionId,
        env: { SESSIONS: mockKv },
      })

      await destroySession(c as never)

      // Check that an expired cookie was added
      const cookieJar = c._contextVars.get('sessionCookies') as string[]
      expect(cookieJar.length).toBeGreaterThan(0)
      expect(cookieJar[0]).toContain('sid=')
      expect(cookieJar[0]).toContain('Expires=')
    })

    it('should set sessionId and sessionData to undefined', async () => {
      const mockKv = createMockKV()
      const sessionId = 'test-session-id'
      const sessionData: SessionData = {
        userId: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        isSuperAdmin: false,
      }

      const c = createMockContext({
        sessionId,
        sessionData,
        env: { SESSIONS: mockKv },
      })

      await destroySession(c as never)

      // Verify set was called with undefined values
      const setCalls = c.set.mock.calls
      const sessionIdCall = setCalls.find((call: unknown[]) => call[0] === 'sessionId' && call[1] === undefined)
      const sessionDataCall = setCalls.find((call: unknown[]) => call[0] === 'sessionData' && call[1] === undefined)

      expect(sessionIdCall).toBeDefined()
      expect(sessionDataCall).toBeDefined()
    })

    it('should use custom options when provided', async () => {
      const mockKv = createMockKV()
      const sessionId = 'test-session-id'
      await mockKv.put(`custom:${sessionId}`, JSON.stringify({ userId: 'user-123' }))

      const c = createMockContext({
        sessionId,
        env: { SESSIONS: mockKv },
      })

      await destroySession(c as never, {
        cookieName: 'custom-session',
        keyPrefix: 'custom:',
      })

      expect(mockKv.delete).toHaveBeenCalledWith(`custom:${sessionId}`)

      const cookieJar = c._contextVars.get('sessionCookies') as string[]
      expect(cookieJar[0]).toContain('custom-session=')
    })
  })

  describe('sessionMiddleware', () => {
    it('should read session from cookie and populate context', async () => {
      const mockKv = createMockKV()
      const sessionId = 'valid-session-id'
      const sessionData: SessionData = {
        userId: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        isSuperAdmin: false,
        fingerprint: { userAgent: 'TestAgent/1.0' },
      }
      await mockKv.put(`sid:${sessionId}`, JSON.stringify(sessionData))

      const contextVars = new Map<string, unknown>()
      const c = {
        req: {
          url: 'http://localhost:3000/test',
          header: vi.fn().mockImplementation((name: string) => {
            if (name === 'user-agent') return 'TestAgent/1.0'
            return undefined
          }),
          raw: {
            headers: new Headers(),
          },
        },
        env: { SESSIONS: mockKv },
        get: vi.fn().mockImplementation((key: string) => contextVars.get(key)),
        set: vi.fn().mockImplementation((key: string, value: unknown) => contextVars.set(key, value)),
        header: vi.fn(),
      }

      // Mock getCookie by injecting cookie header
      c.req.raw.headers.set('Cookie', `sid=${sessionId}`)

      const middleware = sessionMiddleware()
      let nextCalled = false
      await middleware(c as never, async () => { nextCalled = true })

      expect(nextCalled).toBe(true)
      expect(contextVars.get('sessionId')).toBe(sessionId)
      expect(contextVars.get('sessionData')).toEqual(sessionData)
    })

    it('should invalidate session on fingerprint mismatch', async () => {
      const mockKv = createMockKV()
      const sessionId = 'hijacked-session-id'
      const sessionData: SessionData = {
        userId: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        isSuperAdmin: false,
        fingerprint: { userAgent: 'OriginalAgent/1.0' },
      }
      await mockKv.put(`sid:${sessionId}`, JSON.stringify(sessionData))

      const contextVars = new Map<string, unknown>()
      const c = {
        req: {
          url: 'http://localhost:3000/test',
          header: vi.fn().mockImplementation((name: string) => {
            if (name === 'user-agent') return 'DifferentAgent/2.0' // Different user agent
            return undefined
          }),
          raw: {
            headers: new Headers(),
          },
        },
        env: { SESSIONS: mockKv },
        get: vi.fn().mockImplementation((key: string) => contextVars.get(key)),
        set: vi.fn().mockImplementation((key: string, value: unknown) => contextVars.set(key, value)),
        header: vi.fn(),
      }

      c.req.raw.headers.set('Cookie', `sid=${sessionId}`)

      // Suppress console.warn during test
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const middleware = sessionMiddleware()
      let nextCalled = false
      await middleware(c as never, async () => { nextCalled = true })

      expect(nextCalled).toBe(true)
      // Session should be deleted due to fingerprint mismatch
      expect(mockKv.delete).toHaveBeenCalledWith(`sid:${sessionId}`)
      // Context should NOT have session data
      expect(contextVars.get('sessionId')).toBeUndefined()
      expect(contextVars.get('sessionData')).toBeUndefined()

      consoleSpy.mockRestore()
    })

    it('should initialize sessionCookies array', async () => {
      const mockKv = createMockKV()
      const contextVars = new Map<string, unknown>()
      const c = {
        req: {
          url: 'http://localhost:3000/test',
          header: vi.fn().mockReturnValue(undefined),
          raw: {
            headers: new Headers(),
          },
        },
        env: { SESSIONS: mockKv },
        get: vi.fn().mockImplementation((key: string) => contextVars.get(key)),
        set: vi.fn().mockImplementation((key: string, value: unknown) => contextVars.set(key, value)),
        header: vi.fn(),
      }

      const middleware = sessionMiddleware()
      await middleware(c as never, async () => {})

      expect(contextVars.get('sessionCookies')).toEqual([])
    })
  })
})
