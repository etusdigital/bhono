// src/server/index.ts
import { Hono } from 'hono'
import { secureHeaders } from 'hono/secure-headers'
import type { HonoEnv } from './types'
import { createDb } from './db/client'
import { auth } from './routes/auth'
import { api } from './routes'
import { health } from './routes/health'
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

// Mount routes
// Health checks (no auth required) - must be before /api
app.route('/health', health)

// Auth routes
app.route('/auth', auth)

// API routes (with auth)
app.route('/api', api)

export default app
