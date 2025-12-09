// src/routes/invitations/index.ts
import { OpenAPIHono } from '@hono/zod-openapi'
import type { HonoEnv } from '../../types'
import { requireRole } from '../../auth/guards'
import {
  createInvitationRoute,
  listInvitationsRoute,
  revokeInvitationRoute,
} from './routes'
import {
  createInvitationHandler,
  listInvitationsHandler,
  revokeInvitationHandler,
} from './handlers'

const invitationsRouter = new OpenAPIHono<HonoEnv>()

// All routes require MANAGER or ADMIN
invitationsRouter.use('/*', requireRole('MANAGER'))

invitationsRouter.openapi(createInvitationRoute, createInvitationHandler)
invitationsRouter.openapi(listInvitationsRoute, listInvitationsHandler)
invitationsRouter.openapi(revokeInvitationRoute, revokeInvitationHandler)

export { invitationsRouter }
