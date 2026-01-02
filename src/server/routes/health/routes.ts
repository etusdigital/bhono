import { createRoute, z } from '@hono/zod-openapi'

const HealthResponseSchema = z.object({
  status: z.enum(['healthy', 'unhealthy']).openapi({
    example: 'healthy',
    description: 'Overall health status'
  }),
  timestamp: z.iso.datetime().openapi({
    example: '2025-12-30T10:00:00Z',
    description: 'UTC timestamp when check was performed'
  }),
  checks: z.object({
    database: z.enum(['up', 'down']).openapi({
      example: 'up',
      description: 'Database connectivity status'
    }),
    storage: z.enum(['up', 'down']).openapi({
      example: 'up',
      description: 'R2 storage connectivity status'
    })
  }),
  uptime: z.number().openapi({
    example: 3600,
    description: 'Seconds since server started'
  })
}).openapi('HealthResponse')

const ReadyResponseSchema = z.object({
  ready: z.boolean().openapi({
    example: true,
    description: 'Whether the system is ready to serve traffic'
  })
}).openapi('ReadyResponse')

const LiveResponseSchema = z.object({
  alive: z.boolean().openapi({
    example: true,
    description: 'Whether the system process is alive'
  })
}).openapi('LiveResponse')

export const healthRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Health'],
  summary: 'Overall health check with dependency status',
  description: 'Checks database and storage connectivity',
  responses: {
    200: {
      description: 'System is healthy',
      content: { 'application/json': { schema: HealthResponseSchema } }
    },
    503: {
      description: 'System is unhealthy',
      content: { 'application/json': { schema: HealthResponseSchema } }
    }
  }
})

export const readyRoute = createRoute({
  method: 'get',
  path: '/ready',
  tags: ['Health'],
  summary: 'Readiness probe for orchestration',
  description: 'Returns 200 if system is ready to accept traffic, 503 otherwise',
  responses: {
    200: {
      description: 'System is ready',
      content: { 'application/json': { schema: ReadyResponseSchema } }
    },
    503: {
      description: 'System is not ready',
      content: { 'application/json': { schema: ReadyResponseSchema } }
    }
  }
})

export const liveRoute = createRoute({
  method: 'get',
  path: '/live',
  tags: ['Health'],
  summary: 'Liveness probe for orchestration',
  description: 'Returns 200 if process is alive',
  responses: {
    200: {
      description: 'System is alive',
      content: { 'application/json': { schema: LiveResponseSchema } }
    }
  }
})
