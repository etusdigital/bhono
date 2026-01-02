// src/routes/invitations/schemas.ts
import { z } from '@hono/zod-openapi'

export const CreateInvitationSchema = z.object({
  email: z.email().openapi({ description: 'Email address to invite' }),
  role: z.enum(['ADMIN', 'MANAGER', 'EDITOR', 'AUTHOR', 'VIEWER', 'BILLING', 'ANALYTICS']).openapi({
    description: 'Role to assign (cannot exceed your own role)',
  }),
})

export const InvitationSchema = z.object({
  id: z.string(),
  email: z.email(),
  role: z.string(),
  expiresAt: z.string(),
  createdAt: z.string(),
  invitedBy: z.object({
    id: z.string(),
    name: z.string(),
  }),
})

export const InvitationResultSchema = z.object({
  linked: z.boolean(),
  invited: z.boolean(),
  user: z.object({
    id: z.string(),
    email: z.string(),
    name: z.string(),
  }).optional(),
  invitation: z.object({
    id: z.string(),
    email: z.string(),
    role: z.string(),
    expiresAt: z.string(),
  }).optional(),
})

export const InvitationsListSchema = z.array(InvitationSchema)
