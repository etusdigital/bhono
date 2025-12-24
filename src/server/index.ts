// src/server/index.ts
import { Hono } from 'hono'
import { secureHeaders } from 'hono/secure-headers'
import type { Env } from './env'
import { createDb } from './db/client'
import { auth } from './routes/auth'
import { api } from './routes'
import {
  errorHandler,
  requestLogger,
  configurableCors,
  requestContext,
} from './middleware'
import { sessionMiddleware } from './lib/session'

// Hono app with bindings
const app = new Hono<{ Bindings: Env }>()

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
  })(c, next)
})

// 5. Security headers
app.use('*', secureHeaders())

// 6. Database middleware - create db instance per request
app.use('*', async (c, next) => {
  const db = createDb(c.env.DB)
  c.set('db', db)
  await next()
})

// 7. Session middleware - read session from KV
app.use('*', sessionMiddleware())

// Mount routes
app.route('/auth', auth)
app.route('/api', api)

export default app
