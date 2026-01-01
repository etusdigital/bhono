import { OpenAPIHono } from '@hono/zod-openapi'
import { swaggerUI } from '@hono/swagger-ui'
import type { HonoEnv } from '../types'
import { sessionAuth, accountMiddleware } from '../middleware'
import { users } from './users'
import { accounts } from './accounts'
import { invitationsRouter } from './invitations'
import { audits } from './audits'
import { storage } from './storage'

const api = new OpenAPIHono<HonoEnv>()

// Apply auth middleware to all routes except documentation
api.use('/*', async (c, next) => {
  // Skip auth for documentation endpoints
  if (c.req.path === '/api/doc' || c.req.path === '/api/swagger') {
    return next()
  }
  return sessionAuth(c, next)
})
api.use('/*', async (c, next) => {
  // Skip account middleware for documentation endpoints
  if (c.req.path === '/api/doc' || c.req.path === '/api/swagger') {
    return next()
  }
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
api.doc('/doc', {
  openapi: '3.0.0',
  info: {
    title: 'Hono Boilerplate API',
    version: '1.0.0',
    description: 'Multi-tenant API with role-based access control. Uses session-based authentication via cookies. Login via /auth/login to start a session.',
  },
  servers: [
    { url: 'http://localhost:3000', description: 'Development server' },
  ],
  security: [{ SessionCookie: [] }],
})

// Swagger UI
api.get('/swagger', swaggerUI({ url: '/api/doc' }))

export { api }
