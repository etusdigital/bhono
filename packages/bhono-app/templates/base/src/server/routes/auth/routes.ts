// src/routes/auth/routes.ts
import { createRoute, z } from '@hono/zod-openapi'
import {
  AuthTokensSchema,
  SessionUserSchema,
  LoginQuerySchema,
  CallbackQuerySchema,
  AuthErrorSchema,
} from './schemas'

export const loginRoute = createRoute({
  method: 'get',
  path: '/login',
  tags: ['Auth'],
  summary: 'Initiate Google OAuth login',
  description: 'Redirects to Google OAuth consent screen',
  request: {
    query: LoginQuerySchema,
  },
  responses: {
    302: {
      description: 'Redirect to Google OAuth',
    },
  },
})

export const callbackRoute = createRoute({
  method: 'get',
  path: '/callback',
  tags: ['Auth'],
  summary: 'Google OAuth callback',
  description: 'Handles Google OAuth callback, creates session, and redirects to app',
  request: {
    query: CallbackQuerySchema,
  },
  responses: {
    302: {
      description: 'Redirect to application after successful authentication',
    },
    400: {
      description: 'Invalid callback',
      content: { 'application/json': { schema: AuthErrorSchema } },
    },
  },
})

export const refreshRoute = createRoute({
  method: 'post',
  path: '/refresh',
  tags: ['Auth'],
  summary: 'Refresh access token',
  description: 'Uses refresh token from cookie to issue new access token',
  responses: {
    200: {
      description: 'Token refreshed',
      content: {
        'application/json': {
          schema: z.object({
            tokens: AuthTokensSchema,
          }),
        },
      },
    },
    401: {
      description: 'Invalid refresh token',
      content: { 'application/json': { schema: AuthErrorSchema } },
    },
  },
})

export const logoutRoute = createRoute({
  method: 'post',
  path: '/logout',
  tags: ['Auth'],
  summary: 'Logout user',
  description: 'Revokes refresh token and clears cookie',
  responses: {
    200: {
      description: 'Logged out successfully',
      content: {
        'application/json': {
          schema: z.object({
            message: z.string(),
          }),
        },
      },
    },
  },
})

export const meRoute = createRoute({
  method: 'get',
  path: '/me',
  tags: ['Auth'],
  summary: 'Get current user',
  description: 'Returns authenticated user info from session',
  security: [{ Bearer: [] }],
  responses: {
    200: {
      description: 'Current user info',
      content: {
        'application/json': {
          schema: z.object({
            user: SessionUserSchema,
          }),
        },
      },
    },
    401: {
      description: 'Not authenticated',
      content: { 'application/json': { schema: AuthErrorSchema } },
    },
  },
})

export const inviteRoute = createRoute({
  method: 'get',
  path: '/invite/{token}',
  tags: ['Auth'],
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
      content: { 'application/json': { schema: AuthErrorSchema } },
    },
  },
})
