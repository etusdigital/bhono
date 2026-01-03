import type { RouteHandler } from '@hono/zod-openapi'
import type { ServiceContext, HonoEnv } from '../../types'
import { usersService } from '../../services'
import type {
  listUsersRoute,
  getUserRoute,
  updateUserRoute,
  deleteUserRoute,
  createBulkUserAccountsRoute,
  deleteBulkUserAccountsRoute,
  restoreUserRoute,
} from './routes'

export const listUsersHandler: RouteHandler<typeof listUsersRoute, HonoEnv> = async (c) => {
  const query = c.req.valid('query')
  const db = c.get('db')
  const accountId = c.get('accountId')
  const user = c.get('user')
  const transactionId = c.get('transactionId')
  const ip = c.get('ip')
  const userAgent = c.get('userAgent')

  if (!db || !accountId || !user) {
    throw new Error('Missing required context')
  }

  const ctx: ServiceContext = {
    accountId,
    user,
    transactionId,
    ip,
    userAgent,
  }

  const result = await usersService.findAll(db, ctx, {
    page: query.page,
    limit: query.limit,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
    query: query.query,
  })

  return c.json(result, 200)
}

export const getUserHandler: RouteHandler<typeof getUserRoute, HonoEnv> = async (c) => {
  const { id } = c.req.valid('param')
  const db = c.get('db')
  const accountId = c.get('accountId')
  const user = c.get('user')
  const transactionId = c.get('transactionId')
  const ip = c.get('ip')
  const userAgent = c.get('userAgent')

  if (!db || !accountId || !user) {
    throw new Error('Missing required context')
  }

  const ctx: ServiceContext = {
    accountId,
    user,
    transactionId,
    ip,
    userAgent,
  }

  const foundUser = await usersService.findById(db, ctx, id)
  return c.json({ data: foundUser }, 200)
}

// NOTE: User creation is disabled - users should only be created through Google OAuth
/*
export async function createUserHandler(c: any) {
  const data = c.req.valid('json')
  const accountId = c.get('accountId')
  const user = c.get('user')!
  const transactionId = c.get('transactionId')
  const ip = c.get('ip')
  const userAgent = c.get('userAgent')

  const ctx: ServiceContext = {
    accountId,
    user,
    transactionId,
    ip,
    userAgent,
  }

  const newUser = await usersService.create(ctx, {
    email: data.email,
    name: data.name,
    role: data.role,
  })

  return c.json({ data: newUser }, 201)
}
*/

export const updateUserHandler: RouteHandler<typeof updateUserRoute, HonoEnv> = async (c) => {
  const { id } = c.req.valid('param')
  const data = c.req.valid('json')
  const db = c.get('db')
  const accountId = c.get('accountId')
  const user = c.get('user')
  const transactionId = c.get('transactionId')
  const ip = c.get('ip')
  const userAgent = c.get('userAgent')

  if (!db || !accountId || !user) {
    throw new Error('Missing required context')
  }

  const ctx: ServiceContext = {
    accountId,
    user,
    transactionId,
    ip,
    userAgent,
  }

  const updatedUser = await usersService.update(db, ctx, id, {
    name: data.name,
    status: data.status,
  })

  return c.json({ data: updatedUser }, 200)
}

export const deleteUserHandler: RouteHandler<typeof deleteUserRoute, HonoEnv> = async (c) => {
  const { id } = c.req.valid('param')
  const db = c.get('db')
  const accountId = c.get('accountId')
  const user = c.get('user')
  const transactionId = c.get('transactionId')
  const ip = c.get('ip')
  const userAgent = c.get('userAgent')

  if (!db || !accountId || !user) {
    throw new Error('Missing required context')
  }

  const ctx: ServiceContext = {
    accountId,
    user,
    transactionId,
    ip,
    userAgent,
  }

  await usersService.delete(db, ctx, id)
  return c.body(null, 204)
}

// Bulk User-Account Operations
export const createBulkUserAccountsHandler: RouteHandler<typeof createBulkUserAccountsRoute, HonoEnv> = async (c) => {
  const data = c.req.valid('json')
  const db = c.get('db')
  const accountId = c.get('accountId')
  const user = c.get('user')
  const transactionId = c.get('transactionId')
  const ip = c.get('ip')
  const userAgent = c.get('userAgent')

  if (!db || !accountId || !user) {
    throw new Error('Missing required context')
  }

  const ctx: ServiceContext = {
    accountId,
    user,
    transactionId,
    ip,
    userAgent,
  }

  const result = await usersService.createUserAccounts(db, ctx, data)
  return c.json(result, 201)
}

export const deleteBulkUserAccountsHandler: RouteHandler<typeof deleteBulkUserAccountsRoute, HonoEnv> = async (c) => {
  const data = c.req.valid('json')
  const db = c.get('db')
  const accountId = c.get('accountId')
  const user = c.get('user')
  const transactionId = c.get('transactionId')
  const ip = c.get('ip')
  const userAgent = c.get('userAgent')

  if (!db || !accountId || !user) {
    throw new Error('Missing required context')
  }

  const ctx: ServiceContext = {
    accountId,
    user,
    transactionId,
    ip,
    userAgent,
  }

  const result = await usersService.deleteUserAccounts(db, ctx, data)
  return c.json(result, 200)
}

export const restoreUserHandler: RouteHandler<typeof restoreUserRoute, HonoEnv> = async (c) => {
  const { id } = c.req.valid('param')
  const db = c.get('db')
  const accountId = c.get('accountId')
  const user = c.get('user')
  const transactionId = c.get('transactionId')
  const ip = c.get('ip')
  const userAgent = c.get('userAgent')

  if (!db || !accountId || !user) {
    throw new Error('Missing required context')
  }

  const ctx: ServiceContext = {
    accountId,
    user,
    transactionId,
    ip,
    userAgent,
  }

  const result = await usersService.restore(db, ctx, id)
  return c.json({ data: result }, 200)
}
