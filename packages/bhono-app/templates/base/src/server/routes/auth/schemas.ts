// src/routes/auth/schemas.ts
import { z } from '@hono/zod-openapi'

export const AuthTokensSchema = z.object({
  accessToken: z.string(),
  expiresIn: z.number(),
})

export const AuthUserSchema = z.object({
  id: z.string(),
  email: z.email(),
  name: z.string(),
  avatarUrl: z.string().nullable().optional(),
  status: z.enum(['active', 'inactive']),
  isSuperAdmin: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

// Simplified user schema for session-based /me endpoint
// Contains only data available in the session, not the full user record
export const SessionUserSchema = z.object({
  id: z.string(),
  email: z.email(),
  name: z.string(),
  avatarUrl: z.string().nullable().optional(),
  isSuperAdmin: z.boolean(),
})

export const LoginQuerySchema = z.object({
  redirect: z.url().optional().openapi({
    description: 'URL to redirect after successful login',
  }),
})

export const CallbackQuerySchema = z.object({
  code: z.string().openapi({
    description: 'Authorization code from Google',
  }),
  state: z.string().openapi({
    description: 'State parameter for CSRF protection',
  }),
})

export const AuthErrorSchema = z.object({
  error: z.string(),
  statusCode: z.number(),
})
