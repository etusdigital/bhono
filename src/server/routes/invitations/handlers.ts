// src/routes/invitations/handlers.ts
import type { RouteHandler } from '@hono/zod-openapi'
import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { invitationsService } from '../../services/invitations'
import type { ServiceContext, HonoEnv } from '../../types'
import type {
  createInvitationRoute,
  listInvitationsRoute,
  revokeInvitationRoute,
} from './routes'

function getServiceContext(c: Context<HonoEnv>): ServiceContext {
  const accountId = c.get('accountId')
  const user = c.get('user')

  if (!accountId || !user) {
    throw new HTTPException(500, { message: 'Missing required context' })
  }

  return {
    accountId,
    user,
    userRole: c.get('userRole'),
    transactionId: c.get('transactionId') ?? '',
    ip: c.get('ip') ?? '',
    userAgent: c.get('userAgent') ?? '',
  }
}

export const createInvitationHandler: RouteHandler<typeof createInvitationRoute, HonoEnv> = async (c) => {
  const body = c.req.valid('json')
  const db = c.get('db')
  const env = c.env
  const ctx = getServiceContext(c)

  const invitationsDb = env.DB ?? db
  if (!invitationsDb) {
    throw new HTTPException(500, { message: 'Database not initialized' })
  }

  const result = await invitationsService.create(invitationsDb, env, ctx, body)

  return c.json(result, 200)
}

export const listInvitationsHandler: RouteHandler<typeof listInvitationsRoute, HonoEnv> = async (c) => {
  const db = c.get('db')
  const ctx = getServiceContext(c)

  const invitationsDb = c.env.DB ?? db
  if (!invitationsDb) {
    throw new HTTPException(500, { message: 'Database not initialized' })
  }

  const invitations = await invitationsService.list(invitationsDb, ctx)

  return c.json({ data: invitations }, 200)
}

export const revokeInvitationHandler: RouteHandler<typeof revokeInvitationRoute, HonoEnv> = async (c) => {
  const { id } = c.req.valid('param')
  const db = c.get('db')
  const ctx = getServiceContext(c)

  const invitationsDb = c.env.DB ?? db
  if (!invitationsDb) {
    throw new HTTPException(500, { message: 'Database not initialized' })
  }

  await invitationsService.revoke(invitationsDb, ctx, id)

  return c.body(null, 204)
}
