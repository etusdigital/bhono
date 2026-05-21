import { OpenAPIHono } from '@hono/zod-openapi'
import { swaggerUI } from '@hono/swagger-ui'
import type { HonoEnv } from '../types'
import { storage } from './storage'
import { openApiConfig } from './openapi'

// Application API router. Identity/tenancy routes (users, accounts,
// invitations, audit) are served by @etus/auth and mounted directly in
// index.ts — this router carries only the boilerplate's own resources.
const api = new OpenAPIHono<HonoEnv>()

api.route('/storage', storage)

// Session cookie auth scheme (issued by @etus/auth on login)
api.openAPIRegistry.registerComponent('securitySchemes', 'SessionCookie', {
  type: 'apiKey',
  in: 'cookie',
  name: 'auth_sid',
  description: 'Session cookie authentication. Login via /auth/login to obtain a session.',
})

api.doc('/doc', openApiConfig)
api.get('/swagger', swaggerUI({ url: '/api/doc' }))

export { api }
export { storage } from './storage'
export { health } from './health'
