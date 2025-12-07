import type { HonoEnv, ServiceContext } from '../../types'
import { accountsService } from '../../services'

// Note: Handler types are inferred from route definitions by @hono/zod-openapi
// Using 'any' is the standard pattern for openapi handlers
export async function listAccountsHandler(c: any) {
  const query = c.req.valid('query')
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

  const result = await accountsService.findAll(ctx, {
    page: query.page,
    limit: query.limit,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
    query: query.query,
  })

  return c.json(result, 200)
}

export async function getAccountHandler(c: any) {
  const { id } = c.req.valid('param')
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

  const account = await accountsService.findById(ctx, id)
  return c.json({ data: account }, 200)
}

export async function createAccountHandler(c: any) {
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

  const newAccount = await accountsService.create(ctx, {
    name: data.name,
    description: data.description,
    domain: data.domain,
  })

  return c.json({ data: newAccount }, 201)
}

export async function updateAccountHandler(c: any) {
  const { id } = c.req.valid('param')
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

  const updatedAccount = await accountsService.update(ctx, id, {
    name: data.name,
    description: data.description,
    domain: data.domain,
  })

  return c.json({ data: updatedAccount }, 200)
}

export async function deleteAccountHandler(c: any) {
  const { id } = c.req.valid('param')
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

  await accountsService.delete(ctx, id)
  return c.body(null, 204)
}
