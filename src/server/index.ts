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

// Hono app with bindings and variables
const app = new Hono<HonoEnv>()

// 1. Global error handler
app.onError(errorHandler)

// 2. Request context (transactionId, IP, userAgent) - must be first for logging
app.use('*', requestContext)

// 3. Request logger (uses transactionId from context)
app.use('*', requestLogger())

// 4. Configurable CORS
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

// 5. Security headers
app.use('*', secureHeaders())

// 6. Rate limiting - global limit of 100 requests per minute
app.use('*', rateLimit())

// 7. Stricter rate limiting for auth endpoints (10 requests per minute)
app.use('/auth/*', authRateLimit())

// 8. Database middleware - create db instance per request
app.use('*', async (c, next) => {
  if (c.env.DB) {
    const db = createDb(c.env.DB)
    c.set('db', db)
  }
  await next()
})

// 9. Session middleware - read session from KV
app.use('*', sessionMiddleware())

// Mount routes
// Health checks (no auth required) - must be before /api
app.route('/health', health)

// Auth routes
app.route('/auth', auth)

// API routes (with auth)
app.route('/api', api)

export default app
