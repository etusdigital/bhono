// src/services/accounts.ts
import type { AccountRecord } from '../db/records'
import { auditedInsert, auditedUpdate, auditedDelete } from '../lib/audited-db'
import { createPaginationMeta, calculateOffset } from '../lib/pagination'
import { NotFoundError, ConflictError, ForbiddenError } from '../lib/errors'
import type { ServiceContext, PaginationQuery, PaginatedResponse, Account } from '../types'
import { queryAll, queryOne, type SqlRow } from '../db/sql'

interface CreateAccountInput {
  name: string
  description?: string
  domain?: string
}

interface UpdateAccountInput {
  name?: string
  description?: string
  domain?: string
}


const ACCOUNT_SELECT_COLUMNS = `
  id,
  name,
  description,
  domain,
  created_at as createdAt,
  updated_at as updatedAt,
  deleted_at as deletedAt
`


function mapAccountRow(row: SqlRow): AccountRecord {
  const createdAt = row.createdAt ?? row.created_at
  const updatedAt = row.updatedAt ?? row.updated_at
  const deletedAt = row.deletedAt ?? row.deleted_at

  return {
    id: String(row.id ?? ''),
    name: String(row.name ?? ''),
    description: row.description ? String(row.description) : null,
    domain: row.domain ? String(row.domain) : null,
    createdAt: String(createdAt ?? ''),
    updatedAt: String(updatedAt ?? ''),
    deletedAt: deletedAt ? String(deletedAt) : null,
  }
}

function toAccount(record: AccountRecord): Account {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    domain: record.domain,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    deletedAt: record.deletedAt,
  }
}

async function findAllSql(
  db: D1Database,
  ctx: ServiceContext,
  pagination: PaginationQuery
): Promise<PaginatedResponse<Account>> {
  const offset = calculateOffset(pagination.page, pagination.limit)
  const whereClauses: string[] = ['a.deleted_at IS NULL']
  const params: unknown[] = []

  if (!ctx.user.isSuperAdmin) {
    whereClauses.push('a.id IN (SELECT account_id FROM user_accounts WHERE user_id = ?)')
    params.push(ctx.user.id)
  }

  if (pagination.query) {
    whereClauses.push('(a.name LIKE ? OR a.domain LIKE ?)')
    const like = `%${pagination.query}%`
    params.push(like, like)
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

  const countRow = await queryOne<{ count: number }>(
    db,
    `SELECT count(*) as count FROM accounts a ${whereSql}`,
    params
  )
  const totalItems = countRow?.count ?? 0

  const rows = await queryAll(
    db,
    `SELECT ${ACCOUNT_SELECT_COLUMNS}
     FROM accounts a
     ${whereSql}
     ORDER BY a.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pagination.limit, offset]
  )

  return {
    data: rows.map((row) => toAccount(mapAccountRow(row))),
    meta: createPaginationMeta(totalItems, pagination.page, pagination.limit),
  }
}

async function findByIdSql(db: D1Database, ctx: ServiceContext, id: string): Promise<Account> {
  const row = await queryOne(
    db,
    `SELECT ${ACCOUNT_SELECT_COLUMNS}
     FROM accounts a
     WHERE a.id = ? AND a.deleted_at IS NULL
     LIMIT 1`,
    [id]
  )

  if (!row) {
    throw new NotFoundError('Account')
  }

  if (!ctx.user.isSuperAdmin) {
    const membership = await queryOne(
      db,
      `SELECT 1 as ok FROM user_accounts WHERE user_id = ? AND account_id = ? LIMIT 1`,
      [ctx.user.id, id]
    )

    if (!membership) {
      throw new NotFoundError('Account')
    }
  }

  return toAccount(mapAccountRow(row))
}

async function createSql(
  db: D1Database,
  ctx: ServiceContext,
  input: CreateAccountInput
): Promise<Account> {
  if (!ctx.user.isSuperAdmin) {
    throw new ForbiddenError('Only super-admin can create accounts')
  }

  if (input.domain) {
    const existing = await queryOne(
      db,
      `SELECT 1 as ok FROM accounts WHERE domain = ? LIMIT 1`,
      [input.domain]
    )

    if (existing) {
      throw new ConflictError('Account with this domain already exists')
    }
  }

  const insertResults = await auditedInsert<AccountRecord>(db, ctx, 'accounts', {
    name: input.name,
    description: input.description ?? null,
    domain: input.domain ?? null,
  })

  const accountRecord = insertResults.at(0)
  if (!accountRecord) {
    throw new Error('Failed to create account')
  }

  return toAccount(mapAccountRow(accountRecord as unknown as SqlRow))
}

async function updateSql(
  db: D1Database,
  ctx: ServiceContext,
  id: string,
  input: UpdateAccountInput
): Promise<Account> {
  if (!ctx.user.isSuperAdmin) {
    throw new ForbiddenError('Only super-admin can update accounts')
  }

  await findByIdSql(db, ctx, id)

  if (input.domain) {
    const existing = await queryOne(
      db,
      `SELECT 1 as ok FROM accounts WHERE domain = ? AND id != ? LIMIT 1`,
      [input.domain, id]
    )

    if (existing) {
      throw new ConflictError('Account with this domain already exists')
    }
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (input.name !== undefined) updates.name = input.name
  if (input.description !== undefined) updates.description = input.description ?? null
  if (input.domain !== undefined) updates.domain = input.domain ?? null

  const updateResults = await auditedUpdate<AccountRecord>(
    db,
    ctx,
    'accounts',
    updates,
    { clause: 'id = ?', params: [id] }
  )

  const accountRecord = updateResults.at(0)
  if (!accountRecord) {
    throw new Error('Failed to update account')
  }

  return toAccount(mapAccountRow(accountRecord as unknown as SqlRow))
}

async function deleteSql(db: D1Database, ctx: ServiceContext, id: string): Promise<void> {
  if (!ctx.user.isSuperAdmin) {
    throw new ForbiddenError('Only super-admin can delete accounts')
  }

  await findByIdSql(db, ctx, id)
  await auditedDelete(db, ctx, 'accounts', { clause: 'id = ?', params: [id] })
}

async function restoreSql(db: D1Database, ctx: ServiceContext, id: string): Promise<Account> {
  if (!ctx.user.isSuperAdmin) {
    throw new ForbiddenError('Only super-admin can restore accounts')
  }

  const row = await queryOne(
    db,
    `SELECT ${ACCOUNT_SELECT_COLUMNS}
     FROM accounts a
     WHERE a.id = ? AND a.deleted_at IS NOT NULL
     LIMIT 1`,
    [id]
  )

  if (!row) {
    throw new NotFoundError('Account not found or not deleted')
  }

  const restoreResults = await auditedUpdate<AccountRecord>(
    db,
    ctx,
    'accounts',
    { deleted_at: null },
    { clause: 'id = ?', params: [id] }
  )

  const restored = restoreResults.at(0)
  if (!restored) {
    throw new NotFoundError('Failed to restore account')
  }

  return toAccount(mapAccountRow(restored as unknown as SqlRow))
}

export const accountsService = {
  async findAll(
    db: D1Database,
    ctx: ServiceContext,
    pagination: PaginationQuery
  ): Promise<PaginatedResponse<Account>> {
    return findAllSql(db, ctx, pagination)
  },

  async findById(db: D1Database, ctx: ServiceContext, id: string): Promise<Account> {
    return findByIdSql(db, ctx, id)
  },

  async create(db: D1Database, ctx: ServiceContext, input: CreateAccountInput): Promise<Account> {
    return createSql(db, ctx, input)
  },

  async update(
    db: D1Database,
    ctx: ServiceContext,
    id: string,
    input: UpdateAccountInput
  ): Promise<Account> {
    return updateSql(db, ctx, id, input)
  },

  async delete(db: D1Database, ctx: ServiceContext, id: string): Promise<void> {
    await deleteSql(db, ctx, id)
  },

  async restore(db: D1Database, ctx: ServiceContext, id: string): Promise<Account> {
    return restoreSql(db, ctx, id)
  },
}
