// src/server/routes/audits/handlers.ts
import type { ServiceContext } from '../../types'
import { auditsService } from '../../services/audits'

export async function listAuditLogsHandler(c: any) {
  const query = c.req.valid('query')
  const db = c.get('db')
  const accountId = c.get('accountId')
  const user = c.get('user')!
  const transactionId = c.get('transactionId')
  const ip = c.get('ip')
  const userAgent = c.get('userAgent')

  const ctx: ServiceContext = {
    accountId,
    user,
    transactionId,
    ip,
    userAgent,
  }

  const result = await auditsService.findAll(db, ctx, {
    page: query.page,
    limit: query.limit,
    entity: query.entity,
    entityId: query.entityId,
    action: query.action,
  })

  return c.json(result, 200)
}
