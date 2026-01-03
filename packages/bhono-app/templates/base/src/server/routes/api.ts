// src/server/routes/api.ts
import { OpenAPIHono } from '@hono/zod-openapi'
import { swaggerUI } from '@hono/swagger-ui'
import type { Env } from '../env'
import { users } from './users'
import { accounts } from './accounts'
import { invitationsRouter } from './invitations'
import { storage } from './storage'
import { audits } from './audits'
import { sessionAuth, accountMiddleware } from '../middleware'

const api = new OpenAPIHono<{ Bindings: Env }>()

// Apply auth middleware to all API routes (session-based)
api.use('/*', sessionAuth)
api.use('/*', accountMiddleware)

// Mount resource routers
api.route('/users', users)
api.route('/accounts', accounts)
api.route('/invitations', invitationsRouter)
api.route('/storage', storage)
api.route('/audits', audits)

// OpenAPI documentation
api.doc('/doc', {
  openapi: '3.0.0',
  info: {
    title: 'Hono Boilerplate API',
    version: '1.0.0',
    description: 'A production-ready API boilerplate built with Hono, Cloudflare Workers, D1, and R2.',
  },
})

api.get('/docs', swaggerUI({ url: '/api/doc' }))

export { api }
