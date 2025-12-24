// src/server/routes/audits/routes.ts
import { createRoute } from '@hono/zod-openapi'
import { AuditLogFiltersSchema, PaginatedAuditLogsSchema } from './schemas'
import { ErrorResponseSchema } from '../schemas'

export const listAuditLogsRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Audits'],
  summary: 'List audit logs',
  description: 'Returns paginated audit logs filtered by entity, entityId, or action. Requires ADMIN role or ANALYTICS role.',
  request: {
    query: AuditLogFiltersSchema,
  },
  responses: {
    200: {
      description: 'List of audit logs',
      content: { 'application/json': { schema: PaginatedAuditLogsSchema } },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    403: {
      description: 'Forbidden - requires ADMIN or ANALYTICS role',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})
