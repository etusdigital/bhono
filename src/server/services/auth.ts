// src/services/auth.ts
import { isSuperAdminEmail, type Env } from '../env'
import type { UserRecord } from '../db/records'
import { createAccessToken, generateRefreshToken, hashToken, getRefreshTokenExpiry } from '../lib/tokens'
import { UnauthorizedError } from '../lib/errors'
import { logAuthEvent, type AuthEventContext } from '../lib/audit'
import type { GoogleUserInfo, AuthTokens } from '../types/auth'
import type { User } from '../types'
import { execute, queryOne, toStringValue, toNullableString, type SqlRow, type SqlParams } from '../db/sql'

interface AuthResult {
  user: User
  tokens: AuthTokens
  refreshToken: string
  isNewUser: boolean
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


function toEpochSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000)
}

function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') return value === '1' || value.toLowerCase() === 'true'
  return false
}

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

function mapUserRow(row: SqlRow): UserRecord {
  return {
    id: toStringValue(row.id),
    googleId: toStringValue(row.googleId),
    email: toStringValue(row.email),
    name: toStringValue(row.name),
    avatarUrl: toNullableString(row.avatarUrl),
    status: (row.status === 'inactive' ? 'inactive' : 'active'),
    providerIds: parseProviderIds(row.providerIds),
    isSuperAdmin: toBoolean(row.isSuperAdmin),
    createdAt: toStringValue(row.createdAt),
    updatedAt: toStringValue(row.updatedAt),
    deletedAt: toNullableString(row.deletedAt),
  }
}

function toUser(record: UserRecord): User {
  return {
    id: record.id,
    email: record.email,
    name: record.name,
    status: record.status,
    providerIds: record.providerIds,
    isSuperAdmin: record.isSuperAdmin,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    deletedAt: record.deletedAt,
  }
}

async function selectUserByGoogleId(db: D1Database, googleId: string): Promise<UserRecord | null> {
  const row = await queryOne(
    db,
    `SELECT ${USER_SELECT_COLUMNS}
     FROM users
     WHERE google_id = ? AND deleted_at IS NULL
     LIMIT 1`,
    [googleId]
  )
  return row ? mapUserRow(row) : null
}

async function selectUserById(db: D1Database, userId: string): Promise<UserRecord | null> {
  const row = await queryOne(
    db,
    `SELECT ${USER_SELECT_COLUMNS}
     FROM users
     WHERE id = ? AND deleted_at IS NULL
     LIMIT 1`,
    [userId]
  )
  return row ? mapUserRow(row) : null
}

async function updateUserSql(
  db: D1Database,
  userId: string,
  updates: Record<string, unknown>
): Promise<UserRecord | null> {
  const columns = Object.keys(updates)
  if (columns.length === 0) return selectUserById(db, userId)

  const setClause = columns.map((column) => `${column} = ?`).join(', ')
  const params = columns.map((column) => updates[column]) as SqlParams
  await execute(
    db,
    `UPDATE users SET ${setClause} WHERE id = ?`,
    [...params, userId]
  )

  return selectUserById(db, userId)
}

async function insertUserSql(
  db: D1Database,
  values: Record<string, unknown>
): Promise<UserRecord | null> {
  const columns = Object.keys(values)
  const placeholders = columns.map(() => '?').join(', ')
  const params = columns.map((column) => values[column]) as SqlParams

  await execute(
    db,
    `INSERT INTO users (${columns.join(', ')}) VALUES (${placeholders})`,
    params
  )

  return selectUserById(db, toStringValue(values.id))
}

async function findOrCreateUserSql(
  db: D1Database,
  env: Env,
  googleUser: GoogleUserInfo,
  ctx: AuthEventContext
): Promise<AuthResult> {
  let isNewUser = false
  let userRecord = await selectUserByGoogleId(db, googleUser.sub)

  if (userRecord) {
    const shouldUpdate =
      userRecord.email !== googleUser.email ||
      userRecord.name !== googleUser.name ||
      userRecord.avatarUrl !== googleUser.picture

    if (shouldUpdate) {
      userRecord = await updateUserSql(db, userRecord.id, {
        email: googleUser.email,
        name: googleUser.name,
        avatar_url: googleUser.picture ?? null,
        updated_at: new Date().toISOString(),
      }) ?? userRecord
    }
  } else {
    isNewUser = true
    const shouldBeSuperAdmin = isSuperAdminEmail(env, googleUser.email)
    const now = new Date().toISOString()
    const userId = crypto.randomUUID()

    userRecord = await insertUserSql(db, {
      id: userId,
      google_id: googleUser.sub,
      email: googleUser.email,
      name: googleUser.name,
      avatar_url: googleUser.picture ?? null,
      status: 'active',
      is_super_admin: shouldBeSuperAdmin ? 1 : 0,
      created_at: now,
      updated_at: now,
    })

    if (!userRecord) {
      throw new Error('Failed to create user')
    }

    const accountId = crypto.randomUUID()
    await execute(
      db,
      `INSERT INTO accounts (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)`,
      [accountId, `${googleUser.name}'s Account`, now, now]
    )

    await execute(
      db,
      `INSERT INTO user_accounts (user_id, account_id, role) VALUES (?, ?, ?)`,
      [userRecord.id, accountId, 'EDITOR']
    )

    await logAuthEvent(db, ctx, 'SIGNUP', userRecord.id, {
      email: userRecord.email,
      provider: 'google',
      accountId,
    })
  }

  const accessToken = await createAccessToken(env, userRecord.id, userRecord.email)
  const refreshToken = generateRefreshToken()
  const tokenHash = await hashToken(refreshToken)
  const expiresAt = toEpochSeconds(getRefreshTokenExpiry(env))
  const createdAt = Math.floor(Date.now() / 1000)

  await execute(
    db,
    `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [crypto.randomUUID(), userRecord.id, tokenHash, expiresAt, createdAt]
  )

  await logAuthEvent(db, ctx, 'LOGIN', userRecord.id, {
    email: userRecord.email,
    provider: 'google',
    isNewUser,
  })

  return {
    user: toUser(userRecord),
    tokens: {
      accessToken,
      expiresIn: 60 * 15,
    },
    refreshToken,
    isNewUser,
  }
}

async function refreshAccessTokenSql(
  db: D1Database,
  env: Env,
  refreshToken: string,
  ctx: AuthEventContext
): Promise<AuthTokens> {
  const tokenHash = await hashToken(refreshToken)
  const now = Math.floor(Date.now() / 1000)

  const tokenRecord = await queryOne(
    db,
    `SELECT id, user_id as userId, token_hash as tokenHash
     FROM refresh_tokens
     WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?
     LIMIT 1`,
    [tokenHash, now]
  )

  if (!tokenRecord) {
    throw new UnauthorizedError('Invalid or expired refresh token')
  }

  const userRecord = await selectUserById(db, toStringValue(tokenRecord.userId))
  if (userRecord?.status !== 'active') {
    throw new UnauthorizedError('User not found or inactive')
  }

  const accessToken = await createAccessToken(env, userRecord.id, userRecord.email)

  await logAuthEvent(db, ctx, 'TOKEN_REFRESH', userRecord.id, {
    email: userRecord.email,
  })

  return {
    accessToken,
    expiresIn: 60 * 15,
  }
}

async function revokeRefreshTokenSql(
  db: D1Database,
  refreshToken: string
): Promise<void> {
  const tokenHash = await hashToken(refreshToken)
  const revokedAt = Math.floor(Date.now() / 1000)

  await execute(
    db,
    `UPDATE refresh_tokens SET revoked_at = ? WHERE token_hash = ?`,
    [revokedAt, tokenHash]
  )
}

async function revokeAllUserTokensSql(db: D1Database, userId: string): Promise<void> {
  const revokedAt = Math.floor(Date.now() / 1000)

  await execute(
    db,
    `UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`,
    [revokedAt, userId]
  )
}

async function getCurrentUserSql(db: D1Database, userId: string): Promise<User> {
  const userRecord = await selectUserById(db, userId)
  if (!userRecord) {
    throw new UnauthorizedError('User not found')
  }
  return toUser(userRecord)
}

export const authService = {
  async findOrCreateUser(
    db: D1Database,
    env: Env,
    googleUser: GoogleUserInfo,
    ctx: AuthEventContext
  ): Promise<AuthResult> {
    return findOrCreateUserSql(db, env, googleUser, ctx)
  },

  async refreshAccessToken(
    db: D1Database,
    env: Env,
    refreshToken: string,
    ctx: AuthEventContext
  ): Promise<AuthTokens> {
    return refreshAccessTokenSql(db, env, refreshToken, ctx)
  },

  async revokeRefreshToken(
    db: D1Database,
    refreshToken: string,
    ctx: AuthEventContext,
    userId: string | null
  ): Promise<void> {
    await revokeRefreshTokenSql(db, refreshToken)
    if (userId) {
      await logAuthEvent(db, ctx, 'LOGOUT', userId, {})
    }
  },

  async revokeAllUserTokens(db: D1Database, userId: string): Promise<void> {
    await revokeAllUserTokensSql(db, userId)
  },

  async getCurrentUser(db: D1Database, userId: string): Promise<User> {
    return getCurrentUserSql(db, userId)
  },
}
