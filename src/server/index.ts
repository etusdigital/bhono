// src/server/index.ts
import { Hono } from 'hono'
import { secureHeaders } from 'hono/secure-headers'
import type { HonoEnv } from './types'
import type { Env } from './env'
import { getAuth } from './auth/setup'
import { api } from './routes'
import { health } from './routes/health'
import { devLogin } from './routes/dev-login'
import {
  errorHandler,
  requestLogger,
  configurableCors,
  requestContext,
  rateLimit,
  authRateLimit,
} from './middleware'
import { validateEnv } from './env'

// The app is built lazily on the first request: @etus/auth needs the ETUS_*
// config vars, which only exist at request time in Cloudflare Workers. The
// built app is cached for the isolate's lifetime (env is stable per deploy).
let appInstance: Hono<HonoEnv> | undefined

function buildApp(env: Env): Hono<HonoEnv> {
  const auth = getAuth(env)
  const app = new Hono<HonoEnv>()

  // 1. Global error handler
  app.onError(errorHandler)

  // 2. Request context (transactionId, IP, userAgent)
  app.use('*', requestContext)

  // 3. Environment validation
  app.use('*', async (c, next) => {
    validateEnv(c.env)
    await next()
  })

  // 4. Request logger
  app.use('*', requestLogger())

  // 5. Configurable CORS
  app.use('*', async (c, next) => {
    const corsOrigins = c.env.CORS_ORIGINS
      ? c.env.CORS_ORIGINS.split(',').map((o) => o.trim())
      : []
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- Hono wildcard route typing
    return configurableCors({ corsOrigins, appUrl: c.env.APP_URL })(c, next)
  })

  // 6. Security headers
  app.use('*', secureHeaders())

  // 7. Global rate limiting
  app.use('*', rateLimit())

  // 8. Stricter rate limiting for login endpoints (brute-force protection)
  const loginRateLimiter = authRateLimit()
  app.use('/auth/*', async (c, next) => {
    const path = c.req.path
    if (path === '/auth/login' || path === '/auth/callback') {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- Hono wildcard route typing
      return loginRateLimiter(c, next)
    }
    return next()
  })

  // 9. Database binding into context (per request)
  app.use('*', async (c, next) => {
    if (c.env.DB) {
      c.set('db', c.env.DB)
    }
    await next()
  })

  // Health checks (no auth) — before everything else
  app.route('/health', health)

  // Dev-only test-login. The route itself is always mounted; the handler
  // returns 403 unless the request comes from localhost.
  app.route('/auth/test-login', devLogin)

  // @etus/auth routes — OAuth flow, admin user management, accounts, invitations, audit
  app.route('/auth', auth.routes())
  app.route('/auth/admin', auth.adminRoutes())
  app.route('/audit', auth.auditRoutes())
  app.route('/accounts', auth.accountRoutes())
  app.route('/invitations', auth.invitationRoutes())

  // Protected application API — requires authentication (docs are public)
  app.use('/api/*', async (c, next) => {
    if (c.req.path === '/api/doc' || c.req.path === '/api/swagger') {
      return next()
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- Hono wildcard route typing
    return auth.middleware()(c, next)
  })
  app.route('/api', api)

  return app
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Response | Promise<Response> {
    appInstance ??= buildApp(env)
    return appInstance.fetch(request, env, ctx)
  },
}
