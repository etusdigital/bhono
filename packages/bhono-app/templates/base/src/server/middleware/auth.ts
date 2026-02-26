// src/middleware/auth.ts
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import type { HonoEnv } from '../types'
import { getSession } from '../lib/session'
import { queryOne, toStringValue, toNullableString, type SqlRow } from '../db/sql'


const USER_SELECT_COLUMNS = `
  id,
  email,
  name,
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

function mapUserRow(row: SqlRow) {
  const providerIds = row.providerIds ?? row.provider_ids
  const isSuperAdmin = row.isSuperAdmin ?? row.is_super_admin
  const createdAt = row.createdAt ?? row.created_at
  const updatedAt = row.updatedAt ?? row.updated_at
  const deletedAt = row.deletedAt ?? row.deleted_at

  return {
    id: toStringValue(row.id),
    email: toStringValue(row.email),
    name: toStringValue(row.name),
    status: row.status === 'inactive' ? 'inactive' : 'active',
    providerIds: parseProviderIds(providerIds),
    isSuperAdmin: toBoolean(isSuperAdmin),
    createdAt: toStringValue(createdAt),
    updatedAt: toStringValue(updatedAt),
    deletedAt: toNullableString(deletedAt),
  }
}

/**
 * Session-based authentication middleware
 * Validates session from cookie and loads user from database
 */
export const sessionAuth = createMiddleware<HonoEnv>(async (c, next) => {
  const session = getSession(c)

  if (!session) {
    throw new HTTPException(401, {
      message: 'Not authenticated',
    })
  }

  // Look up user in database to ensure they still exist and are active
  const db = c.get('db')
  const authDb = c.env.DB ?? db
  if (!authDb) {
    throw new HTTPException(500, { message: 'Database not initialized' })
  }
  const user = await queryOne(
    authDb,
    `SELECT ${USER_SELECT_COLUMNS}
     FROM users
     WHERE id = ? AND deleted_at IS NULL
     LIMIT 1`,
    [session.userId]
  )
  if (!user) {
    throw new HTTPException(401, {
      message: 'User not found',
    })
  }

  const mappedUser = mapUserRow(user)

  if (mappedUser.status !== 'active') {
    throw new HTTPException(401, {
      message: 'User account is not active',
    })
  }

  // Set user in context
  c.set('user', {
    id: mappedUser.id,
    email: mappedUser.email,
    name: mappedUser.name,
    status: mappedUser.status,
    providerIds: mappedUser.providerIds,
    isSuperAdmin: mappedUser.isSuperAdmin,
    createdAt: mappedUser.createdAt,
    updatedAt: mappedUser.updatedAt,
    deletedAt: mappedUser.deletedAt,
  })

  await next()
})
