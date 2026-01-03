// src/services/auth.ts
import { eq, and, isNull, gt } from 'drizzle-orm'
import type { Database } from '../db/client'
import { isSuperAdminEmail, type Env } from '../env'
import { users, accounts, userAccounts, refreshTokens } from '../db/schema'
import { createAccessToken, generateRefreshToken, hashToken, getRefreshTokenExpiry } from '../lib/tokens'
import { UnauthorizedError } from '../lib/errors'
import { logAuthEvent, type AuthEventContext } from '../lib/audit'
import type { GoogleUserInfo, AuthTokens } from '../types/auth'
import type { User } from '../types'

interface AuthResult {
  user: User
  tokens: AuthTokens
  refreshToken: string
  isNewUser: boolean
}

export const authService = {
  async findOrCreateUser(db: Database, env: Env, googleUser: GoogleUserInfo, ctx: AuthEventContext): Promise<AuthResult> {
    let isNewUser = false

    // Try to find existing user by googleId
    const existingUsers = await db
      .select()
      .from(users)
      .where(and(eq(users.googleId, googleUser.sub), isNull(users.deletedAt)))
      .limit(1)

    let userRecord = existingUsers.at(0)

    if (userRecord) {
      // Update profile info if changed
      if (
        userRecord.email !== googleUser.email ||
        userRecord.name !== googleUser.name ||
        userRecord.avatarUrl !== googleUser.picture
      ) {
        const updated = await db
          .update(users)
          .set({
            email: googleUser.email,
            name: googleUser.name,
            avatarUrl: googleUser.picture ?? null,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(users.id, userRecord.id))
          .returning()
        userRecord = updated[0]
      }
    } else {
      isNewUser = true

      // Create new user (check if email is pre-registered as super admin)
      const shouldBeSuperAdmin = isSuperAdminEmail(env, googleUser.email)
      const created = await db
        .insert(users)
        .values({
          googleId: googleUser.sub,
          email: googleUser.email,
          name: googleUser.name,
          avatarUrl: googleUser.picture ?? null,
          status: 'active',
          isSuperAdmin: shouldBeSuperAdmin,
        })
        .returning()
      userRecord = created[0]

      // Create personal account
      const createdAccounts = await db
        .insert(accounts)
        .values({
          name: `${googleUser.name}'s Account`,
        })
        .returning()
      const accountRecord = createdAccounts[0]

      // Link user to account with EDITOR role
      await db.insert(userAccounts).values({
        userId: userRecord.id,
        accountId: accountRecord.id,
        role: 'EDITOR',
      })

      // Log signup event
      await logAuthEvent(db, ctx, 'SIGNUP', userRecord.id, {
        email: userRecord.email,
        provider: 'google',
        accountId: accountRecord.id,
      })
    }

    // Generate tokens
    const accessToken = await createAccessToken(env, userRecord.id, userRecord.email)
    const refreshToken = generateRefreshToken()
    const tokenHash = await hashToken(refreshToken)

    // Store refresh token
    await db.insert(refreshTokens).values({
      userId: userRecord.id,
      tokenHash,
      expiresAt: getRefreshTokenExpiry(env),
    })

    // Log login event
    await logAuthEvent(db, ctx, 'LOGIN', userRecord.id, {
      email: userRecord.email,
      provider: 'google',
      isNewUser,
    })

    return {
      user: {
        id: userRecord.id,
        email: userRecord.email,
        name: userRecord.name,
        status: userRecord.status,
        providerIds: userRecord.providerIds ?? [],
        isSuperAdmin: userRecord.isSuperAdmin,
        createdAt: userRecord.createdAt,
        updatedAt: userRecord.updatedAt,
        deletedAt: userRecord.deletedAt,
      },
      tokens: {
        accessToken,
        expiresIn: 60 * 15, // 15 minutes in seconds
      },
      refreshToken,
      isNewUser,
    }
  },

  async refreshAccessToken(db: Database, env: Env, refreshToken: string, ctx: AuthEventContext): Promise<AuthTokens> {
    const tokenHash = await hashToken(refreshToken)

    // Find valid refresh token
    const tokenResults = await db
      .select()
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.tokenHash, tokenHash),
          isNull(refreshTokens.revokedAt),
          gt(refreshTokens.expiresAt, new Date())
        )
      )
      .limit(1)

    const tokenRecord = tokenResults.at(0)
    if (!tokenRecord) {
      throw new UnauthorizedError('Invalid or expired refresh token')
    }

    // Get user
    const userResults = await db
      .select()
      .from(users)
      .where(and(eq(users.id, tokenRecord.userId), isNull(users.deletedAt)))
      .limit(1)

    const userRecord = userResults.at(0)
    if (userRecord?.status !== 'active') {
      throw new UnauthorizedError('User not found or inactive')
    }

    // Generate new access token
    const accessToken = await createAccessToken(env, userRecord.id, userRecord.email)

    // Log token refresh event
    await logAuthEvent(db, ctx, 'TOKEN_REFRESH', userRecord.id, {
      email: userRecord.email,
    })

    return {
      accessToken,
      expiresIn: 60 * 15,
    }
  },

  async revokeRefreshToken(db: Database, refreshToken: string, ctx: AuthEventContext, userId: string | null): Promise<void> {
    const tokenHash = await hashToken(refreshToken)

    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.tokenHash, tokenHash))

    // Log logout event if userId provided
    if (userId) {
      await logAuthEvent(db, ctx, 'LOGOUT', userId, {})
    }
  },

  async revokeAllUserTokens(db: Database, userId: string): Promise<void> {
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)))
  },

  async getCurrentUser(db: Database, userId: string): Promise<User> {
    const results = await db
      .select()
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .limit(1)

    const userRecord = results.at(0)
    if (!userRecord) {
      throw new UnauthorizedError('User not found')
    }

    return {
      id: userRecord.id,
      email: userRecord.email,
      name: userRecord.name,
      status: userRecord.status,
      providerIds: userRecord.providerIds ?? [],
      isSuperAdmin: userRecord.isSuperAdmin,
      createdAt: userRecord.createdAt,
      updatedAt: userRecord.updatedAt,
      deletedAt: userRecord.deletedAt,
    }
  },
}
