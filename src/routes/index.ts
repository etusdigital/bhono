import { OpenAPIHono } from '@hono/zod-openapi'
import { swaggerUI } from '@hono/swagger-ui'
import type { HonoEnv } from '../types'
import { jwtAuth, accountMiddleware } from '../middleware'
import { users } from './users'
import { accounts } from './accounts'

const api = new OpenAPIHono<HonoEnv>()

// Apply auth middleware to all routes
api.use('/*', jwtAuth)
api.use('/*', accountMiddleware)

// Mount routers
api.route('/users', users)
api.route('/accounts', accounts)

// OpenAPI documentation
api.doc('/doc', {
  openapi: '3.0.0',
  info: {
    title: 'Hono Boilerplate API',
    version: '1.0.0',
    description: 'Multi-tenant API with role-based access control',
  },
  servers: [
    { url: 'http://localhost:3000', description: 'Development server' },
  ],
})

// Swagger UI
api.get('/swagger', swaggerUI({ url: '/api/doc' }))

export { api }
