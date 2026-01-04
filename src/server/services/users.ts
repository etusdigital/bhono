// src/services/users.ts
import type { UserRecord } from '../db/records'
import { logAudit } from '../lib/audit'
import { auditedUpdate, auditedDelete } from '../lib/audited-db'
import { createPaginationMeta, calculateOffset } from '../lib/pagination'
import { NotFoundError } from '../lib/errors'
import type { ServiceContext, PaginationQuery, PaginatedResponse, User } from '../types'
import type { Role } from '../auth/roles'
import { execute, queryAll, queryOne, type SqlRow, type SqlParams } from '../db/sql'

// NOTE: CreateUserInput is commented out since user creation is disabled
// (users should only be created through Google OAuth)

interface UpdateUserInput {
  name?: string
  status?: 'active' | 'inactive'
}


const USER_SELECT_COLUMNS = `
  id,
  google_id as googleId,
  email,
  name,
  avatar_url as avatarUrl,
  status,
  provider_ids as providerIds,
  is_super_admin as isSuperAdmin,
  created_at as createdAt,
  updated_at as updatedAt,
  deleted_at as deletedAt
`


function parseProviderIds(value: unknown): string[] {
  if (!value) return []
  if (Array.isArray(value)) return value.map((item) => String(item))
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item))
      }
    } catch {
      return []
    }
  }
  return []
}

function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') return value === '1' || value.toLowerCase() === 'true'
  return false
}

function mapUserRow(row: SqlRow): UserRecord {
  const googleId = row.googleId ?? row.google_id
  const avatarUrl = row.avatarUrl ?? row.avatar_url
  const providerIds = row.providerIds ?? row.provider_ids
  const isSuperAdmin = row.isSuperAdmin ?? row.is_super_admin
  const createdAt = row.createdAt ?? row.created_at
  const updatedAt = row.updatedAt ?? row.updated_at
  const deletedAt = row.deletedAt ?? row.deleted_at

  return {
    id: String(row.id ?? ''),
    googleId: String(googleId ?? ''),
    email: String(row.email ?? ''),
    name: String(row.name ?? ''),
    avatarUrl: avatarUrl ? String(avatarUrl) : null,
    status: row.status === 'inactive' ? 'inactive' : 'active',
    providerIds: parseProviderIds(providerIds),
    isSuperAdmin: toBoolean(isSuperAdmin),
    createdAt: String(createdAt ?? ''),
    updatedAt: String(updatedAt ?? ''),
    deletedAt: deletedAt ? String(deletedAt) : null,
  }
}

function toUser(record: UserRecord): User {
  return {
    id: record.id,
    email: record.email,
    name: record.name,
    status: record.status,
    providerIds: record.providerIds ?? [],
    isSuperAdmin: record.isSuperAdmin,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    deletedAt: record.deletedAt,
  }
}

async function findAllSql(
  db: D1Database,
  ctx: ServiceContext,
  pagination: PaginationQuery
): Promise<PaginatedResponse<User>> {
  const offset = calculateOffset(pagination.page, pagination.limit)
  const whereClauses: string[] = ['u.deleted_at IS NULL']
  const params: SqlParams = []

  if (!ctx.user.isSuperAdmin) {
    whereClauses.push('u.id IN (SELECT user_id FROM user_accounts WHERE account_id = ?)')
    params.push(ctx.accountId)
  }

  if (pagination.query) {
    whereClauses.push('(u.email LIKE ? OR u.name LIKE ?)')
    const like = `%${pagination.query}%`
    params.push(like, like)
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

  const countRow = await queryOne<{ count: number }>(
    db,
    `SELECT count(*) as count FROM users u ${whereSql}`,
    params
  )
  const totalItems = countRow?.count ?? 0

  const rows = await queryAll(
    db,
    `SELECT ${USER_SELECT_COLUMNS}
     FROM users u
     ${whereSql}
     ORDER BY u.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pagination.limit, offset]
  )

  return {
    data: rows.map((row) => toUser(mapUserRow(row))),
    meta: createPaginationMeta(totalItems, pagination.page, pagination.limit),
  }
}

async function findByIdSql(
  db: D1Database,
  ctx: ServiceContext,
  id: string
): Promise<User> {
  const row = await queryOne(
    db,
    `SELECT ${USER_SELECT_COLUMNS}
     FROM users u
     WHERE u.id = ? AND u.deleted_at IS NULL
     LIMIT 1`,
    [id]
  )

  if (!row) {
    throw new NotFoundError('User')
  }

  if (!ctx.user.isSuperAdmin) {
    const membership = await queryOne(
      db,
      `SELECT 1 as ok FROM user_accounts WHERE user_id = ? AND account_id = ? LIMIT 1`,
      [id, ctx.accountId]
    )
    if (!membership) {
      throw new NotFoundError('User')
    }
  }

  return toUser(mapUserRow(row))
}

async function updateSql(
  db: D1Database,
  ctx: ServiceContext,
  id: string,
  input: UpdateUserInput
): Promise<User> {
  await findByIdSql(db, ctx, id)

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updated_by_id: ctx.user.id,
  }
  if (input.name !== undefined) updates.name = input.name
  if (input.status !== undefined) updates.status = input.status

  const results = await auditedUpdate<UserRecord>(
    db,
    ctx,
    'users',
    updates,
    { clause: 'id = ?', params: [id] }
  )

  const updated = results.at(0)
  if (!updated) {
    throw new Error('Failed to update user')
  }

  return toUser(mapUserRow(updated as unknown as SqlRow))
}

async function deleteSql(db: D1Database, ctx: ServiceContext, id: string): Promise<void> {
  await findByIdSql(db, ctx, id)
  await auditedDelete(db, ctx, 'users', { clause: 'id = ?', params: [id] })
}

async function restoreSql(db: D1Database, ctx: ServiceContext, id: string): Promise<User> {
  const row = await queryOne(
    db,
    `SELECT ${USER_SELECT_COLUMNS}
     FROM users u
     WHERE u.id = ? AND u.deleted_at IS NOT NULL
     LIMIT 1`,
    [id]
  )

  if (!row) {
    throw new NotFoundError('User not found or not deleted')
  }

  const restored = await auditedUpdate<UserRecord>(
    db,
    ctx,
    'users',
    { deleted_at: null, deleted_by_id: null },
    { clause: 'id = ?', params: [id] }
  )

  const restoredRow = restored.at(0)
  if (!restoredRow) {
    throw new NotFoundError('Failed to restore user')
  }

  return toUser(mapUserRow(restoredRow as unknown as SqlRow))
}

async function listRolesSql(
  db: D1Database,
  ctx: ServiceContext,
  userId: string
): Promise<{ accountId: string; role: Role }[]> {
  await findByIdSql(db, ctx, userId)

  const rows = await queryAll(
    db,
    `SELECT account_id as accountId, role
     FROM user_accounts
     WHERE user_id = ?`,
    [userId]
  )

  return rows.map((row) => ({
    accountId: String(row.accountId ?? row.account_id ?? ''),
    role: String(row.role ?? '') as Role,
  }))
}

async function updateRoleSql(
  db: D1Database,
  ctx: ServiceContext,
  userId: string,
  accountId: string,
  role: Role
): Promise<void> {
  await findByIdSql(db, ctx, userId)

  const membership = await queryOne(
    db,
    `SELECT role FROM user_accounts WHERE user_id = ? AND account_id = ? LIMIT 1`,
    [userId, accountId]
  )

  if (!membership) {
    throw new NotFoundError('User not found in account')
  }

  await execute(
    db,
    `UPDATE user_accounts SET role = ? WHERE user_id = ? AND account_id = ?`,
    [role, userId, accountId]
  )

  await logAudit(db, ctx, 'UserAccount', `${userId}-${accountId}`, 'UPDATE', { role })
}

async function removeFromAccountSql(
  db: D1Database,
  ctx: ServiceContext,
  userId: string,
  accountId: string
): Promise<void> {
  await findByIdSql(db, ctx, userId)

  await execute(
    db,
    `DELETE FROM user_accounts WHERE user_id = ? AND account_id = ?`,
    [userId, accountId]
  )

  await logAudit(db, ctx, 'UserAccount', `${userId}-${accountId}`, 'DELETE', {
    userId,
    accountId,
  })
}

async function createUserAccountsSql(
  db: D1Database,
  ctx: ServiceContext,
  items: { userId: string; accountId: string; role: Role }[]
): Promise<{ success: boolean; count: number }> {
  let count = 0

  for (const item of items) {
    const existing = await queryOne(
      db,
      `SELECT role FROM user_accounts WHERE user_id = ? AND account_id = ? LIMIT 1`,
      [item.userId, item.accountId]
    )

    if (existing) {
      await execute(
        db,
        `UPDATE user_accounts SET role = ? WHERE user_id = ? AND account_id = ?`,
        [item.role, item.userId, item.accountId]
      )
    } else {
      await execute(
        db,
        `INSERT INTO user_accounts (user_id, account_id, role) VALUES (?, ?, ?)`,
        [item.userId, item.accountId, item.role]
      )
    }

    count++

    await logAudit(db, ctx, 'UserAccount', `${item.userId}-${item.accountId}`, 'INSERT', {
      userId: item.userId,
      accountId: item.accountId,
      role: item.role,
    })
  }

  return { success: true, count }
}

async function deleteUserAccountsSql(
  db: D1Database,
  ctx: ServiceContext,
  items: { userId: string; accountId: string; role: Role }[]
): Promise<{ success: boolean; count: number }> {
  let count = 0

  for (const item of items) {
    await execute(
      db,
      `DELETE FROM user_accounts WHERE user_id = ? AND account_id = ?`,
      [item.userId, item.accountId]
    )

    count++

    await logAudit(db, ctx, 'UserAccount', `${item.userId}-${item.accountId}`, 'DELETE', {
      userId: item.userId,
      accountId: item.accountId,
    })
  }

  return { success: true, count }
}

export const usersService = {
  async findAll(
    db: D1Database,
    ctx: ServiceContext,
    pagination: PaginationQuery
  ): Promise<PaginatedResponse<User>> {
    return findAllSql(db, ctx, pagination)
  },

  async findById(db: D1Database, ctx: ServiceContext, id: string): Promise<User> {
    return findByIdSql(db, ctx, id)
  },

  async update(db: D1Database, ctx: ServiceContext, id: string, input: UpdateUserInput): Promise<User> {
    return updateSql(db, ctx, id, input)
  },

  async delete(db: D1Database, ctx: ServiceContext, id: string): Promise<void> {
    await deleteSql(db, ctx, id)
  },

  async restore(db: D1Database, ctx: ServiceContext, id: string): Promise<User> {
    return restoreSql(db, ctx, id)
  },

  async listUserRoles(
    db: D1Database,
    ctx: ServiceContext,
    userId: string
  ): Promise<{ accountId: string; role: Role }[]> {
    return listRolesSql(db, ctx, userId)
  },

  async updateRole(
    db: D1Database,
    ctx: ServiceContext,
    userId: string,
    accountId: string,
    role: Role
  ): Promise<void> {
    await updateRoleSql(db, ctx, userId, accountId, role)
  },

  async removeFromAccount(
    db: D1Database,
    ctx: ServiceContext,
    userId: string,
    accountId: string
  ): Promise<void> {
    await removeFromAccountSql(db, ctx, userId, accountId)
  },

  async createUserAccounts(
    db: D1Database,
    ctx: ServiceContext,
    items: { userId: string; accountId: string; role: Role }[]
  ): Promise<{ success: boolean; count: number }> {
    return createUserAccountsSql(db, ctx, items)
  },

  async deleteUserAccounts(
    db: D1Database,
    ctx: ServiceContext,
    items: { userId: string; accountId: string; role: Role }[]
  ): Promise<{ success: boolean; count: number }> {
    return deleteUserAccountsSql(db, ctx, items)
  },
}
