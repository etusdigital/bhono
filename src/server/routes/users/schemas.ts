import { z } from '@hono/zod-openapi'
import { createPaginatedSchema } from '../schemas'

export const UserSchema = z
  .object({
    id: z.string().uuid().openapi({ example: '550e8400-e29b-41d4-a716-446655440000' }),
    email: z.string().email().openapi({ example: 'user@example.com' }),
    name: z.string().openapi({ example: 'John Doe' }),
    status: z.enum(['active', 'inactive']).openapi({ example: 'active' }),
    isSuperAdmin: z.boolean().openapi({ example: false }),
    createdAt: z.string().datetime().openapi({ example: '2024-01-01T00:00:00Z' }),
    updatedAt: z.string().datetime().openapi({ example: '2024-01-01T00:00:00Z' }),
  })
  .openapi('User')

export const CreateUserSchema = z
  .object({
    email: z.string().email().openapi({ example: 'newuser@example.com' }),
    name: z.string().min(1).max(255).openapi({ example: 'Jane Doe' }),
    role: z
      .enum(['ADMIN', 'MANAGER', 'EDITOR', 'AUTHOR', 'VIEWER', 'BILLING', 'ANALYTICS'])
      .default('VIEWER')
      .openapi({ example: 'VIEWER' }),
  })
  .openapi('CreateUserInput')

export const UpdateUserSchema = z
  .object({
    name: z.string().min(1).max(255).optional().openapi({ example: 'Updated Name' }),
    status: z.enum(['active', 'inactive']).optional().openapi({ example: 'active' }),
  })
  .openapi('UpdateUserInput')

export const PaginatedUsersSchema = createPaginatedSchema(UserSchema, 'Users')
