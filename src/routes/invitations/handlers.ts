// src/routes/invitations/handlers.ts
import { invitationsService } from '../../services/invitations'
import type { ServiceContext } from '../../types'

function getServiceContext(c: any): ServiceContext {
  return {
    accountId: c.get('accountId'),
    user: c.get('user'),
    userRole: c.get('userRole'),
    transactionId: c.get('transactionId'),
    ip: c.get('ip'),
    userAgent: c.get('userAgent'),
  }
}

export const createInvitationHandler = async (c: any) => {
  const body = c.req.valid('json')
  const ctx = getServiceContext(c)

  const result = await invitationsService.create(ctx, body)

  return c.json(result, 200)
}

export const listInvitationsHandler = async (c: any) => {
  const ctx = getServiceContext(c)

  const invitations = await invitationsService.list(ctx)

  return c.json({ data: invitations }, 200)
}

export const revokeInvitationHandler = async (c: any) => {
  const { id } = c.req.valid('param')
  const ctx = getServiceContext(c)

  await invitationsService.revoke(ctx, id)

  return c.body(null, 204)
}
