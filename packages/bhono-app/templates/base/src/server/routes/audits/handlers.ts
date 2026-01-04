// src/server/routes/audits/handlers.ts
import type { RouteHandler } from '@hono/zod-openapi'
import type { ServiceContext, HonoEnv } from '../../types'
import { auditsService } from '../../services/audits'
import type { listAuditLogsRoute } from './routes'

export const listAuditLogsHandler: RouteHandler<typeof listAuditLogsRoute, HonoEnv> = async (c) => {
  const query = c.req.valid('query')
  const db = c.get('db')
  const envDb = c.env.DB
  const accountId = c.get('accountId')
  const user = c.get('user')
  const transactionId = c.get('transactionId')
  const ip = c.get('ip')
  const userAgent = c.get('userAgent')

  if (!db || !accountId || !user) {
    throw new Error('Missing required context')
  }

  const ctx: ServiceContext = {
    accountId,
    user,
    transactionId,
    ip,
    userAgent,
  }

  const auditsDb = envDb ?? db
  const result = await auditsService.findAll(auditsDb, ctx, {
    page: query.page,
    limit: query.limit,
    entity: query.entity,
    entityId: query.entityId,
    action: query.action,
  })

  return c.json(result, 200)
}
