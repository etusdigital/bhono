// src/server/index.ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import type { Env } from './env'
import { createDb } from './db/client'
import { auth } from './routes/auth'
import { api } from './routes'

// Hono app with bindings
const app = new Hono<{ Bindings: Env }>()

// Global middleware
app.use('*', logger())
app.use('*', secureHeaders())
app.use('*', cors({
  origin: (origin, c) => origin || c.env.APP_URL,
  credentials: true,
}))

// Database middleware - create db instance per request
app.use('*', async (c, next) => {
  const db = createDb(c.env.DB)
  c.set('db', db)
  await next()
})

// Mount routes
app.route('/auth', auth)
app.route('/api', api)

export default app
