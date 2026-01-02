import { z } from '@hono/zod-openapi'
import { createPaginatedSchema } from '../schemas'

export const AccountSchema = z
  .object({
    id: z.uuid().openapi({ example: '550e8400-e29b-41d4-a716-446655440000' }),
    name: z.string().openapi({ example: 'Acme Corp' }),
    description: z.string().nullable().openapi({ example: 'Main business account' }),
    domain: z.string().nullable().openapi({ example: 'acme.com' }),
    createdAt: z.iso.datetime().openapi({ example: '2024-01-01T00:00:00Z' }),
    updatedAt: z.iso.datetime().openapi({ example: '2024-01-01T00:00:00Z' }),
  })
  .openapi('Account')

export const CreateAccountSchema = z
  .object({
    name: z.string().min(1).max(255).openapi({ example: 'New Account' }),
    description: z.string().max(1000).optional().openapi({ example: 'Account description' }),
    domain: z.string().max(255).optional().openapi({ example: 'example.com' }),
  })
  .openapi('CreateAccountInput')

export const UpdateAccountSchema = z
  .object({
    name: z.string().min(1).max(255).optional().openapi({ example: 'Updated Name' }),
    description: z.string().max(1000).optional().openapi({ example: 'Updated description' }),
    domain: z.string().max(255).optional().openapi({ example: 'updated.com' }),
  })
  .openapi('UpdateAccountInput')

export const PaginatedAccountsSchema = createPaginatedSchema(AccountSchema, 'Accounts')
