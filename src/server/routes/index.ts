import { OpenAPIHono } from '@hono/zod-openapi'
import { swaggerUI } from '@hono/swagger-ui'
import type { HonoEnv } from '../types'
import { sessionAuth, accountMiddleware } from '../middleware'
import { users } from './users'
import { accounts } from './accounts'
import { invitationsRouter } from './invitations'
import { audits } from './audits'
import { storage } from './storage'
import { openApiConfig } from './openapi'

const api = new OpenAPIHono<HonoEnv>()

// Apply auth middleware to all routes except documentation
api.use('/*', async (c, next) => {
  // Skip auth for documentation endpoints
  if (c.req.path === '/api/doc' || c.req.path === '/api/swagger') {
    return next()
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- Hono wildcard route typing
  return sessionAuth(c, next)
})
api.use('/*', async (c, next) => {
  // Skip account middleware for documentation endpoints
  if (c.req.path === '/api/doc' || c.req.path === '/api/swagger') {
    return next()
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- Hono wildcard route typing
  return accountMiddleware(c, next)
})

// Mount routers
api.route('/users', users)
api.route('/accounts', accounts)
api.route('/invitations', invitationsRouter)
api.route('/audits', audits)
api.route('/storage', storage)

// Register security scheme component (session-based authentication via cookies)
api.openAPIRegistry.registerComponent('securitySchemes', 'SessionCookie', {
  type: 'apiKey',
  in: 'cookie',
  name: 'sid',
  description: 'Session cookie authentication. Login via /auth/login to obtain session.',
})

// OpenAPI documentation
api.doc('/doc', openApiConfig)

// Swagger UI
api.get('/swagger', swaggerUI({ url: '/api/doc' }))

export { api }

// Re-export individual routers for testing
export { users } from './users'
export { accounts } from './accounts'
export { invitationsRouter } from './invitations'
export { audits } from './audits'
export { storage } from './storage'
export { health } from './health'
