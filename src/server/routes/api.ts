// src/server/routes/api.ts
import { OpenAPIHono } from '@hono/zod-openapi'
import { swaggerUI } from '@hono/swagger-ui'
import type { Env } from '../env'
import { users } from './users'
import { accounts } from './accounts'
import { invitationsRouter } from './invitations'
import { jwtAuth, accountMiddleware } from '../middleware'

const api = new OpenAPIHono<{ Bindings: Env }>()

// Apply auth middleware to all API routes
api.use('/*', jwtAuth)
api.use('/*', accountMiddleware)

// Mount resource routers
api.route('/users', users)
api.route('/accounts', accounts)
api.route('/invitations', invitationsRouter)

// OpenAPI documentation
api.doc('/doc', {
  openapi: '3.0.0',
  info: {
    title: 'Hono Boilerplate API',
    version: '1.0.0',
  },
})

api.get('/docs', swaggerUI({ url: '/api/doc' }))

export { api }
