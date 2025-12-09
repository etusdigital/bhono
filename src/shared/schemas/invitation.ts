// src/shared/schemas/invitation.ts
import { z } from 'zod'

export const CreateInvitationSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'MANAGER', 'EDITOR', 'AUTHOR', 'VIEWER', 'BILLING', 'ANALYTICS']),
})

export type CreateInvitationInput = z.infer<typeof CreateInvitationSchema>
