import { createRoute, z } from '@hono/zod-openapi'
import {
  AccountSchema,
  PaginatedAccountsSchema,
  CreateAccountSchema,
  UpdateAccountSchema,
} from './schemas'
import {
  ErrorResponseSchema,
  PaginationQuerySchema,
  IdParamSchema,
} from '../schemas'

export const listAccountsRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Accounts'],
  summary: 'List accounts',
  request: {
    query: PaginationQuerySchema,
  },
  responses: {
    200: {
      description: 'List of accounts',
      content: { 'application/json': { schema: PaginatedAccountsSchema } },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

export const getAccountRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['Accounts'],
  summary: 'Get account by ID',
  request: {
    params: IdParamSchema,
  },
  responses: {
    200: {
      description: 'Account details',
      content: {
        'application/json': {
          schema: z.object({
            data: AccountSchema,
          }),
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    404: {
      description: 'Account not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

export const createAccountRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Accounts'],
  summary: 'Create new account',
  request: {
    body: {
      content: { 'application/json': { schema: CreateAccountSchema } },
    },
  },
  responses: {
    201: {
      description: 'Account created',
      content: {
        'application/json': {
          schema: z.object({
            data: AccountSchema,
          }),
        },
      },
    },
    400: {
      description: 'Invalid input',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    403: {
      description: 'Forbidden - Super admin only',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    409: {
      description: 'Domain already exists',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

export const updateAccountRoute = createRoute({
  method: 'patch',
  path: '/{id}',
  tags: ['Accounts'],
  summary: 'Update account',
  request: {
    params: IdParamSchema,
    body: {
      content: { 'application/json': { schema: UpdateAccountSchema } },
    },
  },
  responses: {
    200: {
      description: 'Account updated',
      content: {
        'application/json': {
          schema: z.object({
            data: AccountSchema,
          }),
        },
      },
    },
    400: {
      description: 'Invalid input',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    404: {
      description: 'Account not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    409: {
      description: 'Domain already exists',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

export const deleteAccountRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['Accounts'],
  summary: 'Delete account (soft delete)',
  request: {
    params: IdParamSchema,
  },
  responses: {
    204: {
      description: 'Account deleted',
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    403: {
      description: 'Forbidden - Super admin only',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    404: {
      description: 'Account not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

export const restoreAccountRoute = createRoute({
  method: 'post',
  path: '/{id}/restore',
  tags: ['Accounts'],
  summary: 'Restore a soft-deleted account',
  description: 'Restores a soft-deleted account. Only super-admin.',
  request: {
    params: IdParamSchema,
  },
  responses: {
    200: {
      description: 'Account restored successfully',
      content: {
        'application/json': {
          schema: z.object({
            data: AccountSchema,
          }),
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    403: {
      description: 'Forbidden - Super admin only',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    404: {
      description: 'Account not found or not deleted',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})
