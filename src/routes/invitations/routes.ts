// src/routes/invitations/routes.ts
import { createRoute, z } from '@hono/zod-openapi'
import {
  CreateInvitationSchema,
  InvitationResultSchema,
  InvitationsListSchema,
} from './schemas'
import { ErrorResponseSchema, IdParamSchema } from '../schemas'

export const createInvitationRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Invitations'],
  summary: 'Create invitation or link existing user',
  description: 'Invites a new user via email or links an existing user immediately',
  request: {
    body: {
      content: { 'application/json': { schema: CreateInvitationSchema } },
    },
  },
  responses: {
    200: {
      description: 'User linked or invitation sent',
      content: { 'application/json': { schema: InvitationResultSchema } },
    },
    403: {
      description: 'Cannot assign role higher than own',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    409: {
      description: 'User already in account or pending invitation exists',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

export const listInvitationsRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Invitations'],
  summary: 'List pending invitations',
  description: 'Lists all pending (not accepted, not expired) invitations for the account',
  responses: {
    200: {
      description: 'List of pending invitations',
      content: { 'application/json': { schema: z.object({ data: InvitationsListSchema }) } },
    },
  },
})

export const revokeInvitationRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['Invitations'],
  summary: 'Revoke invitation',
  description: 'Cancels a pending invitation',
  request: {
    params: IdParamSchema,
  },
  responses: {
    204: {
      description: 'Invitation revoked',
    },
    404: {
      description: 'Invitation not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})
