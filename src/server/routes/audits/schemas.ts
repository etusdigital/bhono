// src/server/routes/audits/schemas.ts
import { z } from '@hono/zod-openapi'
import { createPaginatedSchema } from '../schemas'

export const AuditLogSchema = z
  .object({
    id: z.string().uuid().openapi({ example: '550e8400-e29b-41d4-a716-446655440000' }),
    transactionId: z.string().openapi({ example: '0192abc1-def0-7890-abcd-ef1234567890' }),
    accountId: z.string().uuid().nullable().openapi({ example: '550e8400-e29b-41d4-a716-446655440001' }),
    userId: z.string().uuid().nullable().openapi({ example: '550e8400-e29b-41d4-a716-446655440002' }),
    entity: z.string().openapi({ example: 'User' }),
    entityId: z.string().openapi({ example: '550e8400-e29b-41d4-a716-446655440003' }),
    action: z.enum(['INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'SIGNUP', 'TOKEN_REFRESH', 'LOGIN_FAILED']).openapi({ example: 'UPDATE' }),
    changes: z.record(z.unknown()).nullable().openapi({
      example: { name: 'John Doe', status: 'active' },
    }),
    ipAddress: z.string().nullable().openapi({ example: '192.168.1.1' }),
    userAgent: z.string().nullable().openapi({ example: 'Mozilla/5.0...' }),
    timestamp: z.string().datetime().openapi({ example: '2024-01-01T00:00:00Z' }),
  })
  .openapi('AuditLog')

export const AuditLogFiltersSchema = z.object({
  page: z.coerce.number().min(1).default(1).openapi({ example: 1 }),
  limit: z.coerce.number().min(1).max(100).default(50).openapi({ example: 50 }),
  entity: z.string().optional().openapi({
    example: 'User',
    description: 'Filter by entity type (e.g., User, Account)',
  }),
  entityId: z.string().optional().openapi({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Filter by entity ID',
  }),
  action: z
    .enum(['INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'SIGNUP', 'TOKEN_REFRESH', 'LOGIN_FAILED'])
    .optional()
    .openapi({
      example: 'UPDATE',
      description: 'Filter by action type',
    }),
})

export const PaginatedAuditLogsSchema = createPaginatedSchema(AuditLogSchema, 'AuditLogs')
