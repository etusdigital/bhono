// src/services/auth.ts
import { eq, and, isNull, gt } from 'drizzle-orm'
import { db } from '../db/client'
import { users, accounts, userAccounts, refreshTokens } from '../db/schema'
import { createAccessToken, generateRefreshToken, hashToken, getRefreshTokenExpiry } from '../lib/tokens'
import { UnauthorizedError } from '../lib/errors'
import type { GoogleUserInfo, AuthTokens } from '../types/auth'
import type { User } from '../types'

interface AuthResult {
  user: User
  tokens: AuthTokens
  refreshToken: string
}

export const authService = {
  async findOrCreateUser(googleUser: GoogleUserInfo): Promise<AuthResult> {
    // Try to find existing user by googleId
    let [userRecord] = await db
      .select()
      .from(users)
      .where(and(eq(users.googleId, googleUser.sub), isNull(users.deletedAt)))
      .limit(1)

    if (userRecord) {
      // Update profile info if changed
      if (
        userRecord.email !== googleUser.email ||
        userRecord.name !== googleUser.name ||
        userRecord.avatarUrl !== googleUser.picture
      ) {
        ;[userRecord] = await db
          .update(users)
          .set({
            email: googleUser.email,
            name: googleUser.name,
            avatarUrl: googleUser.picture || null,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(users.id, userRecord.id))
          .returning()
      }
    } else {
      // Create new user
      ;[userRecord] = await db
        .insert(users)
        .values({
          googleId: googleUser.sub,
          email: googleUser.email,
          name: googleUser.name,
          avatarUrl: googleUser.picture || null,
          status: 'active',
        })
        .returning()

      // Create personal account
      const [accountRecord] = await db
        .insert(accounts)
        .values({
          name: `${googleUser.name}'s Account`,
        })
        .returning()

      // Link user to account with EDITOR role
      await db.insert(userAccounts).values({
        userId: userRecord.id,
        accountId: accountRecord.id,
        role: 'EDITOR',
      })
    }

    // Generate tokens
    const accessToken = await createAccessToken(userRecord.id, userRecord.email)
    const refreshToken = generateRefreshToken()
    const tokenHash = await hashToken(refreshToken)

    // Store refresh token
    await db.insert(refreshTokens).values({
      userId: userRecord.id,
      tokenHash,
      expiresAt: getRefreshTokenExpiry(),
    })

    return {
      user: {
        id: userRecord.id,
        email: userRecord.email,
        name: userRecord.name,
        status: userRecord.status,
        providerIds: userRecord.providerIds || [],
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
    }
  },

  async refreshAccessToken(refreshToken: string): Promise<AuthTokens> {
    const tokenHash = await hashToken(refreshToken)

    // Find valid refresh token
    const [tokenRecord] = await db
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

    if (!tokenRecord) {
      throw new UnauthorizedError('Invalid or expired refresh token')
    }

    // Get user
    const [userRecord] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, tokenRecord.userId), isNull(users.deletedAt)))
      .limit(1)

    if (!userRecord || userRecord.status !== 'active') {
      throw new UnauthorizedError('User not found or inactive')
    }

    // Generate new access token
    const accessToken = await createAccessToken(userRecord.id, userRecord.email)

    return {
      accessToken,
      expiresIn: 60 * 15,
    }
  },

  async revokeRefreshToken(refreshToken: string): Promise<void> {
    const tokenHash = await hashToken(refreshToken)

    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.tokenHash, tokenHash))
  },

  async revokeAllUserTokens(userId: string): Promise<void> {
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)))
  },

  async getCurrentUser(userId: string): Promise<User> {
    const [userRecord] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .limit(1)

    if (!userRecord) {
      throw new UnauthorizedError('User not found')
    }

    return {
      id: userRecord.id,
      email: userRecord.email,
      name: userRecord.name,
      status: userRecord.status,
      providerIds: userRecord.providerIds || [],
      isSuperAdmin: userRecord.isSuperAdmin,
      createdAt: userRecord.createdAt,
      updatedAt: userRecord.updatedAt,
      deletedAt: userRecord.deletedAt,
    }
  },
}
