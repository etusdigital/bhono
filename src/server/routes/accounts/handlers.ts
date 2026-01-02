import type { RouteHandler } from '@hono/zod-openapi'
import type { ServiceContext, HonoEnv } from '../../types'
import { accountsService } from '../../services'
import type {
  listAccountsRoute,
  getAccountRoute,
  createAccountRoute,
  updateAccountRoute,
  deleteAccountRoute,
  restoreAccountRoute,
} from './routes'

export const listAccountsHandler: RouteHandler<typeof listAccountsRoute, HonoEnv> = async (c) => {
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

  const result = await accountsService.findAll(db, ctx, {
    page: query.page,
    limit: query.limit,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
    query: query.query,
  })

  return c.json(result, 200)
}

export const getAccountHandler: RouteHandler<typeof getAccountRoute, HonoEnv> = async (c) => {
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

  const account = await accountsService.findById(db, ctx, id)
  return c.json({ data: account }, 200)
}

export const createAccountHandler: RouteHandler<typeof createAccountRoute, HonoEnv> = async (c) => {
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

  const newAccount = await accountsService.create(db, ctx, {
    name: data.name,
    description: data.description,
    domain: data.domain,
  })

  return c.json({ data: newAccount }, 201)
}

export const updateAccountHandler: RouteHandler<typeof updateAccountRoute, HonoEnv> = async (c) => {
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

  const updatedAccount = await accountsService.update(db, ctx, id, {
    name: data.name,
    description: data.description,
    domain: data.domain,
  })

  return c.json({ data: updatedAccount }, 200)
}

export const deleteAccountHandler: RouteHandler<typeof deleteAccountRoute, HonoEnv> = async (c) => {
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

  await accountsService.delete(db, ctx, id)
  return c.body(null, 204)
}

export const restoreAccountHandler: RouteHandler<typeof restoreAccountRoute, HonoEnv> = async (c) => {
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

  const result = await accountsService.restore(db, ctx, id)
  return c.json({ data: result }, 200)
}
