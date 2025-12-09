import type { HonoEnv, ServiceContext } from '../../types'
import { usersService } from '../../services'

// Note: Handler types are inferred from route definitions by @hono/zod-openapi
// Using 'any' is the standard pattern for openapi handlers
export async function listUsersHandler(c: any) {
  const query = c.req.valid('query')
  const db = c.get('db')
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

  const result = await usersService.findAll(db, ctx, {
    page: query.page,
    limit: query.limit,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
    query: query.query,
  })

  return c.json(result, 200)
}

export async function getUserHandler(c: any) {
  const { id } = c.req.valid('param')
  const db = c.get('db')
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

export async function updateUserHandler(c: any) {
  const { id } = c.req.valid('param')
  const data = c.req.valid('json')
  const db = c.get('db')
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

  const updatedUser = await usersService.update(db, ctx, id, {
    name: data.name,
    status: data.status,
  })

  return c.json({ data: updatedUser }, 200)
}

export async function deleteUserHandler(c: any) {
  const { id } = c.req.valid('param')
  const db = c.get('db')
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

  await usersService.delete(db, ctx, id)
  return c.body(null, 204)
}
