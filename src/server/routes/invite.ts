// src/server/routes/invite.ts
// Public route for accepting invitations (redirects to OAuth)
import { OpenAPIHono } from '@hono/zod-openapi'
import { createRoute, z } from '@hono/zod-openapi'
import { setCookie } from 'hono/cookie'
import { HTTPException } from 'hono/http-exception'
import { invitationsService } from '../services/invitations'
import type { HonoEnv } from '../types'

const inviteRoute = createRoute({
  method: 'get',
  path: '/{token}',
  tags: ['Invitations'],
  summary: 'Accept invitation',
  description: 'Validates invitation token and redirects to OAuth login',
  request: {
    params: z.object({
      token: z.string().openapi({ description: 'Invitation token' }),
    }),
  },
  responses: {
    302: {
      description: 'Redirect to login',
    },
    400: {
      description: 'Invalid or expired invitation',
      content: {
        'application/json': {
          schema: z.object({
            error: z.object({ message: z.string() }),
          }),
        },
      },
    },
  },
})

const inviteRouter = new OpenAPIHono<HonoEnv>()

inviteRouter.openapi(inviteRoute, async (c) => {
  const db = c.get('db')
  const env = c.env
  const { token } = c.req.valid('param')

  const inviteDb = env.DB ?? db
  if (!inviteDb) {
    throw new HTTPException(500, { message: 'Database not initialized' })
  }

  const isProduction = env.ENVIRONMENT === 'production'

  // Validate invitation
  const invitation = await invitationsService.getByToken(inviteDb, token)

  if (!invitation) {
    throw new HTTPException(400, { message: 'Invalid or expired invitation' })
  }

  // Store invitation token in cookie (will be processed by pendingInvitationMiddleware)
  setCookie(c, 'pending_invitation', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'Lax',
    path: '/',
    maxAge: 60 * 60, // 1 hour
  })

  // Redirect to OAuth login
  return c.redirect('/auth/login')
})

export { inviteRouter }
