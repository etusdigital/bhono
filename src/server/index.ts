// src/server/index.ts
import { Hono } from 'hono'
import { secureHeaders } from 'hono/secure-headers'
import { createAuth } from '@etus/auth'
import type { HonoEnv } from './types'
import type { Env } from './env'
import { createDb } from './db/client'
import { api } from './routes'
import { health } from './routes/health'
import { inviteRouter } from './routes/invite'
import { devRouter } from './routes/dev/test-login'
import { pendingInvitationMiddleware } from './middleware/pending-invitation'
import {
  errorHandler,
  requestLogger,
  configurableCors,
  requestContext,
  rateLimit,
  authRateLimit,
} from './middleware'
import { sessionMiddleware } from './lib/session'
import { validateEnv } from './env'

// @etus/auth factory - creates auth instance with environment config
// Called lazily on first request to access env vars (Cloudflare Workers pattern)
function createEtusAuth(env: Env) {
  // Parse comma-separated lists from environment
  const allowedDomains = env.ETUS_ALLOWED_DOMAINS
    ? env.ETUS_ALLOWED_DOMAINS.split(',').map((d) => d.trim())
    : []
  const adminEmails = env.ETUS_ADMIN_EMAILS
    ? env.ETUS_ADMIN_EMAILS.split(',').map((e) => e.trim().toLowerCase())
    : []

  return createAuth({
    gateway: env.ETUS_GATEWAY ?? 'https://ag.etus.io',
    clientId: env.ETUS_CLIENT_ID ?? 'boilerplate-hono',
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Required by @etus/auth, validated in middleware
    db: (e) => (e as Env).DB!,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Required by @etus/auth, validated in middleware
    sessions: (e) => (e as Env).SESSIONS!,
    access: {
      mode: 'open',
      allowedDomains,
      admins: adminEmails,
      // Use uppercase roles to match local RBAC system
      roles: ['ADMIN', 'EDITOR', 'VIEWER', 'BILLING'],
      defaultRole: 'VIEWER',
    },
    session: {
      maxAge: 30 * 24 * 60 * 60, // 30 days
      sliding: true,
    },
    redirects: {
      afterLogin: '/',
      afterLogout: '/login',
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- Required by @etus/auth callback signature
    onNewUser: async (user) => {
      console.log('[AUTH] New user provisioned:', user.id)
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- Required by @etus/auth callback signature
    onLogin: async (user) => {
      console.log('[AUTH] User logged in:', user.id)
    },
  })
}

// Lazy-initialized auth instance (created on first request with env)
let etusAuth: ReturnType<typeof createAuth> | null = null

// Get or create @etus/auth instance (singleton per Worker instance)
function getEtusAuth(env: Env): ReturnType<typeof createAuth> {
  etusAuth ??= createEtusAuth(env)
  return etusAuth
}

// Hono app with bindings and variables
const app = new Hono<HonoEnv>()

// 1. Global error handler
app.onError(errorHandler)

// 2. Request context (transactionId, IP, userAgent) - must be first for logging
app.use('*', requestContext)

// 3. Environment validation - fail fast if misconfigured
app.use('*', async (c, next) => {
  validateEnv(c.env)
  await next()
})

// 4. Request logger (uses transactionId from context)
app.use('*', requestLogger())

// 5. Configurable CORS
app.use('*', async (c, next) => {
  const env = c.env
  const corsOrigins = env.CORS_ORIGINS
    ? env.CORS_ORIGINS.split(',').map((o) => o.trim())
    : []
  return configurableCors({
    corsOrigins,
    appUrl: env.APP_URL,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- Hono wildcard route typing
  })(c, next)
})

// 6. Security headers
app.use('*', secureHeaders())

// 7. Rate limiting - global limit of 100 requests per minute
app.use('*', rateLimit())

// 8. Stricter rate limiting for auth LOGIN endpoints only (10 requests per minute)
// These are the endpoints vulnerable to brute force attacks
// Note: /auth/me, /auth/refresh, /auth/logout use the global rate limit (100 req/min)
// because they are session verification/maintenance, not login attempts
// Create auth rate limiter instance once (not per-request)
const loginRateLimiter = authRateLimit()

app.use('/auth/*', async (c, next) => {
  const path = c.req.path
  // Only apply strict rate limit to login-related endpoints (brute force protection)
  if (path === '/auth/login' || path === '/auth/callback') {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- Hono wildcard route typing
    return loginRateLimiter(c, next)
  }
  // Other auth endpoints (/auth/me, /auth/refresh, /auth/logout) use global rate limit
  return next()
})

// 9. Database middleware - create db instance per request
app.use('*', async (c, next) => {
  if (c.env.DB) {
    const db = createDb(c.env.DB)
    c.set('db', db)
  }
  await next()
})

// 10. Session middleware - read session from KV
app.use('*', sessionMiddleware())

// 11. Pending invitation middleware - auto-accept invitations after login
app.use('*', pendingInvitationMiddleware)

// Mount routes
// Health checks (no auth required) - must be before /api
app.route('/health', health)

// @etus/auth routes (OAuth flow via gateway)
// Uses middleware pattern for lazy initialization with env vars
// Handles: /auth/login, /auth/callback, /auth/logout, /auth/me
app.use('/auth/*', async (c, _next) => {
  const auth = getEtusAuth(c.env)
  const authApp = new Hono<HonoEnv>()
  authApp.route('/', auth.routes())
  authApp.route('/admin', auth.adminRoutes())
  return authApp.fetch(c.req.raw, c.env, c.executionCtx)
})

// Public invite acceptance route
app.route('/invite', inviteRouter)

// Development routes (test-login for E2E tests)
// Only mounted in non-production environments for security
app.use('/dev/*', async (c, _next) => {
  if (c.env.ENVIRONMENT === 'production') {
    return c.json({ error: { message: 'Not found' } }, 404)
  }
  const devApp = new Hono<HonoEnv>()
  devApp.route('/', devRouter)
  return devApp.fetch(c.req.raw, c.env, c.executionCtx)
})

// API routes (with auth)
app.route('/api', api)

export default app
