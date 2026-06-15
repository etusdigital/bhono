// src/server/index.ts
import { Hono } from 'hono'
import type { HonoEnv } from './types'
import type { Env } from './env'
import { getAuth } from './auth/setup'
import { protectAccountOwner } from './auth/guards'
import { requireSupportedAccountMembershipRole } from './auth/package-compat'
import { requireSafeAuthRedirects } from './auth/redirects'
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
  csrfProtection,
  securityHeaders,
  requestBodyLimit,
} from './middleware'
import { parseUploadBytes, validateEnv } from './env'

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
    const hostname = new URL(c.req.url).hostname
    const isLoopback = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
    validateEnv(c.env, { allowMissingClientSecret: isLoopback })
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
  app.use('*', securityHeaders(env))

  // 7. Global rate limiting
  app.use('*', rateLimit())

  // 8. Stricter rate limiting for credential endpoints (brute-force protection)
  const loginRateLimiter = authRateLimit()
  const rateLimitedAuthPaths = new Set(['/auth/login', '/auth/callback', '/auth/test-login'])
  app.use('/auth/*', async (c, next) => {
    if (rateLimitedAuthPaths.has(c.req.path)) {
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

  // 10. CSRF/origin protection for state-changing browser requests.
  app.use('*', csrfProtection())

  // 11. Bound payloads before any route parses request bodies. The R2 upload
  // limit comes from env so operators can raise it without editing middleware.
  app.use('*', requestBodyLimit(undefined, parseUploadBytes(env.MAX_UPLOAD_BYTES)))

  // Health checks (no auth) — before protected routers
  app.route('/health', health)

  // Dev-only test-login. The route itself is always mounted; the handler
  // returns 403 unless the request comes from localhost. Mounted BEFORE
  // the package-protected routers so it can create the very first session.
  app.route('/auth/test-login', devLogin)

  // Require the package's full auth middleware for package-owned protected
  // routers. Those routers expect c.get('authUser') to exist; using the
  // required middleware also preserves session fingerprint enforcement.
  const requireAuthContext = auth.middleware()
  for (const path of [
    '/auth/admin/*',
    '/audit',
    '/audit/*',
    '/accounts',
    '/accounts/*',
    '/invitations',
    '/invitations/*',
  ]) {
    app.use(path, requireAuthContext)
  }

  // Protect the account owner from being demoted by an admin — runs before
  // accountRoutes handles PATCH /accounts/:id/members/:userId.
  app.use('/accounts/:id/members/:userId', protectAccountOwner())

  // Keep the boilerplate account-membership contract narrower than the current
  // package defaults until @etus/auth owns multiTenant.roles/defaultRole.
  app.use('/accounts/:id/members/invite', requireSupportedAccountMembershipRole(['POST']))
  app.use('/accounts/:id/members/:userId', requireSupportedAccountMembershipRole(['PATCH']))

  // @etus/auth routes — OAuth flow, admin user management, accounts, invitations, audit
  app.use('/auth/*', requireSafeAuthRedirects())
  app.route('/auth', auth.routes())
  app.route('/auth/admin', auth.adminRoutes())
  app.route('/audit', auth.auditRoutes())
  // Hybrid model: account/member MANAGEMENT stays LOCAL (these @etus/auth account
  // routes), while per-account ROLES are READ from the gateway for authorization
  // (accountRoleMap + /api/me + requireGatewayAccountRole). The gateway has no
  // app-facing write API for member management, so the local routes are retained
  // on purpose despite the v0.9.x deprecation. See docs/SETUP-GUIDE.md.
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- intentional in the hybrid model
  app.route('/accounts', auth.accountRoutes())
  app.route('/invitations', auth.invitationRoutes())

  // Protected application API — requires authentication (docs are public)
  const resolveAccountContext = auth.accountMiddleware()
  app.use('/api/*', async (c, next) => {
    if (c.req.path === '/api/doc' || c.req.path === '/api/swagger') {
      return next()
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- Hono wildcard route typing
    return requireAuthContext(c, async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- Hono wildcard route typing
      await resolveAccountContext(c, next)
    })
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
