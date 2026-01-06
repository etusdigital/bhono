import type { RouteHandler } from '@hono/zod-openapi'
import { HTTPException } from 'hono/http-exception'
import type { ServiceContext, HonoEnv } from '../../types'
import { accountsService } from '../../services'
import { updateSession, getSession } from '../../lib/session'
import { queryAll, toStringValue, toNullableString } from '../../db/sql'
import { logAudit } from '../../lib/audit'
import type { MembershipRole } from '../../db/records'
import type {
  listAccountsRoute,
  getAccountRoute,
  createAccountRoute,
  updateAccountRoute,
  deleteAccountRoute,
  restoreAccountRoute,
  myAccountsRoute,
  switchAccountRoute,
} from './routes'

export const listAccountsHandler: RouteHandler<typeof listAccountsRoute, HonoEnv> = async (c) => {
  const query = c.req.valid('query')
  const db = c.get('db')
  const envDb = c.env.DB
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

  const accountsDb = envDb ?? db
  const result = await accountsService.findAll(accountsDb, ctx, {
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
  const envDb = c.env.DB
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

  const accountsDb = envDb ?? db
  const account = await accountsService.findById(accountsDb, ctx, id)
  return c.json({ data: account }, 200)
}

export const createAccountHandler: RouteHandler<typeof createAccountRoute, HonoEnv> = async (c) => {
  const data = c.req.valid('json')
  const db = c.get('db')
  const envDb = c.env.DB
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

  const accountsDb = envDb ?? db
  const newAccount = await accountsService.create(accountsDb, ctx, {
    name: data.name,
    description: data.description,
    domain: data.domain,
    slug: data.slug,
    timezone: data.timezone,
    language: data.language,
  })

  return c.json({ data: newAccount }, 201)
}

export const updateAccountHandler: RouteHandler<typeof updateAccountRoute, HonoEnv> = async (c) => {
  const { id } = c.req.valid('param')
  const data = c.req.valid('json')
  const db = c.get('db')
  const envDb = c.env.DB
  const accountId = c.get('accountId')
  const user = c.get('user')
  const userRole = c.get('userRole')
  const transactionId = c.get('transactionId')
  const ip = c.get('ip')
  const userAgent = c.get('userAgent')

  if (!db || !accountId || !user) {
    throw new Error('Missing required context')
  }

  const ctx: ServiceContext = {
    accountId,
    user,
    userRole,
    transactionId,
    ip,
    userAgent,
  }

  const accountsDb = envDb ?? db
  const updatedAccount = await accountsService.update(accountsDb, ctx, id, {
    name: data.name,
    description: data.description,
    domain: data.domain,
    slug: data.slug,
    timezone: data.timezone,
    language: data.language,
  })

  return c.json({ data: updatedAccount }, 200)
}

export const deleteAccountHandler: RouteHandler<typeof deleteAccountRoute, HonoEnv> = async (c) => {
  const { id } = c.req.valid('param')
  const db = c.get('db')
  const envDb = c.env.DB
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

  const accountsDb = envDb ?? db
  await accountsService.delete(accountsDb, ctx, id)
  return c.body(null, 204)
}

export const restoreAccountHandler: RouteHandler<typeof restoreAccountRoute, HonoEnv> = async (c) => {
  const { id } = c.req.valid('param')
  const db = c.get('db')
  const envDb = c.env.DB
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

  const accountsDb = envDb ?? db
  const result = await accountsService.restore(accountsDb, ctx, id)
  return c.json({ data: result }, 200)
}

// Type for my accounts query result
interface MyAccountRow {
  id: string
  name: string
  description: string | null
  domain: string | null
  slug: string | null
  timezone: string | null
  language: string | null
  status: string
  role: string
  // Branding fields (Phase 3)
  logo_url: string | null
  favicon_url: string | null
  primary_color: string | null
  secondary_color: string | null
  accent_color: string | null
}

/**
 * Get all accounts for the current user
 * Per ADR-001: Only returns accounts with active memberships (deleted_at IS NULL)
 */
export const myAccountsHandler: RouteHandler<typeof myAccountsRoute, HonoEnv> = async (c) => {
  const db = c.env.DB ?? c.get('db')
  const user = c.get('user')
  const session = getSession(c)

  if (!db || !user) {
    throw new HTTPException(401, { message: 'Unauthorized' })
  }

  const currentAccountId = session?.currentAccountId ?? c.get('accountId') ?? null

  // Query all accounts where user has active membership
  const rows = await queryAll<MyAccountRow>(
    db,
    `SELECT
      a.id,
      a.name,
      a.description,
      a.domain,
      a.slug,
      a.timezone,
      a.language,
      a.status,
      a.logo_url,
      a.favicon_url,
      a.primary_color,
      a.secondary_color,
      a.accent_color,
      ua.role
    FROM accounts a
    INNER JOIN user_accounts ua ON a.id = ua.account_id
    WHERE ua.user_id = ?
      AND ua.deleted_at IS NULL
      AND a.deleted_at IS NULL
    ORDER BY a.name ASC`,
    [user.id]
  )

  const accounts = rows.map((row) => ({
    id: toStringValue(row.id),
    name: toStringValue(row.name),
    description: toNullableString(row.description),
    domain: toNullableString(row.domain),
    slug: toNullableString(row.slug),
    timezone: toNullableString(row.timezone),
    language: toNullableString(row.language),
    status: row.status === 'suspended' ? ('suspended' as const) : ('active' as const),
    role: row.role as MembershipRole,
    isCurrent: row.id === currentAccountId,
    // Branding fields (Phase 3)
    logoUrl: toNullableString(row.logo_url),
    faviconUrl: toNullableString(row.favicon_url),
    primaryColor: toNullableString(row.primary_color),
    secondaryColor: toNullableString(row.secondary_color),
    accentColor: toNullableString(row.accent_color),
  }))

  return c.json(
    {
      data: accounts,
      currentAccountId,
    },
    200
  )
}

/**
 * Switch to a different account
 * Per ADR-007: currentAccountId in session is source of truth
 * Per ADR-001: Validates membership is active before switching
 */
export const switchAccountHandler: RouteHandler<typeof switchAccountRoute, HonoEnv> = async (c) => {
  const { accountId } = c.req.valid('json')
  const db = c.env.DB ?? c.get('db')
  const user = c.get('user')
  const session = getSession(c)
  const transactionId = c.get('transactionId')
  const ip = c.get('ip')
  const userAgent = c.get('userAgent')

  if (!db || !user || !session) {
    throw new HTTPException(401, { message: 'Unauthorized' })
  }

  // Get the account with membership info
  const rows = await queryAll<MyAccountRow>(
    db,
    `SELECT
      a.id,
      a.name,
      a.description,
      a.domain,
      a.slug,
      a.timezone,
      a.language,
      a.status,
      a.logo_url,
      a.favicon_url,
      a.primary_color,
      a.secondary_color,
      a.accent_color,
      ua.role
    FROM accounts a
    INNER JOIN user_accounts ua ON a.id = ua.account_id
    WHERE a.id = ?
      AND ua.user_id = ?
      AND ua.deleted_at IS NULL
      AND a.deleted_at IS NULL`,
    [accountId, user.id]
  )

  if (rows.length === 0) {
    // Check if account exists but user has no active membership
    const accountExists = await queryAll(
      db,
      `SELECT id FROM accounts WHERE id = ? AND deleted_at IS NULL`,
      [accountId]
    )

    if (accountExists.length === 0) {
      throw new HTTPException(404, { message: 'Account not found' })
    }

    throw new HTTPException(403, {
      message: 'No active membership for this account',
    })
  }

  const row = rows[0]

  // Check account status (non-super-admins cannot switch to suspended accounts)
  if (row.status === 'suspended' && !user.isSuperAdmin) {
    throw new HTTPException(403, {
      message: 'Account is suspended',
    })
  }

  // Update session with new currentAccountId
  await updateSession(c, {
    currentAccountId: accountId,
  })

  // Log the account switch
  await logAudit(db, {
    transactionId: transactionId ?? crypto.randomUUID(),
    accountId,
    userId: user.id,
    entity: 'Account',
    entityId: accountId,
    action: 'ACCOUNT_SWITCHED',
    changes: {
      previousAccountId: session.currentAccountId ?? null,
      newAccountId: accountId,
    },
    ip,
    userAgent,
    impersonatedBy: null,
  })

  const account = {
    id: toStringValue(row.id),
    name: toStringValue(row.name),
    description: toNullableString(row.description),
    domain: toNullableString(row.domain),
    slug: toNullableString(row.slug),
    timezone: toNullableString(row.timezone),
    language: toNullableString(row.language),
    status: row.status === 'suspended' ? ('suspended' as const) : ('active' as const),
    role: row.role as MembershipRole,
    isCurrent: true,
    // Branding fields (Phase 3)
    logoUrl: toNullableString(row.logo_url),
    faviconUrl: toNullableString(row.favicon_url),
    primaryColor: toNullableString(row.primary_color),
    secondaryColor: toNullableString(row.secondary_color),
    accentColor: toNullableString(row.accent_color),
  }

  return c.json(
    {
      success: true,
      currentAccountId: accountId,
      account,
    },
    200
  )
}
