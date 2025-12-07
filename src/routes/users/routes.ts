import { createRoute, z } from '@hono/zod-openapi'
import {
  UserSchema,
  PaginatedUsersSchema,
  CreateUserSchema,
  UpdateUserSchema,
} from './schemas'
import {
  ErrorResponseSchema,
  PaginationQuerySchema,
  IdParamSchema,
} from '../schemas'

export const listUsersRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Users'],
  summary: 'List users in account',
  request: {
    query: PaginationQuerySchema,
  },
  responses: {
    200: {
      description: 'List of users',
      content: { 'application/json': { schema: PaginatedUsersSchema } },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

export const getUserRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['Users'],
  summary: 'Get user by ID',
  request: {
    params: IdParamSchema,
  },
  responses: {
    200: {
      description: 'User details',
      content: {
        'application/json': {
          schema: z.object({
            data: UserSchema,
          }),
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    404: {
      description: 'User not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

export const createUserRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Users'],
  summary: 'Create new user',
  request: {
    body: {
      content: { 'application/json': { schema: CreateUserSchema } },
    },
  },
  responses: {
    201: {
      description: 'User created',
      content: {
        'application/json': {
          schema: z.object({
            data: UserSchema,
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
    409: {
      description: 'Email already exists',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

export const updateUserRoute = createRoute({
  method: 'patch',
  path: '/{id}',
  tags: ['Users'],
  summary: 'Update user',
  request: {
    params: IdParamSchema,
    body: {
      content: { 'application/json': { schema: UpdateUserSchema } },
    },
  },
  responses: {
    200: {
      description: 'User updated',
      content: {
        'application/json': {
          schema: z.object({
            data: UserSchema,
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
      description: 'User not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

export const deleteUserRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['Users'],
  summary: 'Delete user (soft delete)',
  request: {
    params: IdParamSchema,
  },
  responses: {
    204: {
      description: 'User deleted',
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    404: {
      description: 'User not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})
