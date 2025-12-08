# Auth Audit Logging Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add audit logging for authentication events (login, signup, logout, token refresh, failed attempts).

**Architecture:** Extend the existing audit system with auth-specific action types and a dedicated `logAuthEvent` function that works without a full `ServiceContext` (since auth events occur before/during authentication).

**Tech Stack:** Existing Drizzle ORM, audit_logs table, Hono context for request metadata.

---

## Task 1: Extend Audit Log Action Types

**Files:**
- Modify: `src/db/schema/audit-logs.ts`
- Modify: `src/lib/audit.ts`

**Step 1: Update the action enum in schema**

```typescript
// src/db/schema/audit-logs.ts - update line 16
action: text('action', {
  enum: ['INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'SIGNUP', 'TOKEN_REFRESH', 'LOGIN_FAILED']
}).notNull(),
```

**Step 2: Update AuditAction type in audit.ts**

```typescript
// src/lib/audit.ts - update line 5
export type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'SIGNUP' | 'TOKEN_REFRESH' | 'LOGIN_FAILED'
```

**Step 3: Commit**

```bash
git add src/db/schema/audit-logs.ts src/lib/audit.ts
git commit -m "feat(audit): extend action types for auth events"
```

---

## Task 2: Create Auth Audit Logger

**Files:**
- Modify: `src/lib/audit.ts`

**Step 1: Add auth-specific audit function**

Add after the existing `logAudit` function:

```typescript
// Auth event context - doesn't require full ServiceContext
export interface AuthEventContext {
  transactionId: string
  ip: string
  userAgent: string
}

export type AuthAction = 'LOGIN' | 'LOGOUT' | 'SIGNUP' | 'TOKEN_REFRESH' | 'LOGIN_FAILED'

export async function logAuthEvent(
  ctx: AuthEventContext,
  action: AuthAction,
  userId: string | null,
  details: Record<string, unknown>
): Promise<void> {
  await db.insert(auditLogs).values({
    transactionId: ctx.transactionId,
    accountId: null, // Auth events are account-agnostic
    userId,
    entity: 'Auth',
    entityId: userId || 'anonymous',
    action,
    changes: details,
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
  })
}
```

**Step 2: Commit**

```bash
git add src/lib/audit.ts
git commit -m "feat(audit): add logAuthEvent for auth-specific logging"
```

---

## Task 3: Update Auth Service with Audit Logging

**Files:**
- Modify: `src/services/auth.ts`

**Step 1: Update AuthResult and method signatures**

Add context parameter to methods that need logging:

```typescript
// src/services/auth.ts
import { eq, and, isNull, gt } from 'drizzle-orm'
import { db } from '../db/client'
import { users, accounts, userAccounts, refreshTokens } from '../db/schema'
import { createAccessToken, generateRefreshToken, hashToken, getRefreshTokenExpiry } from '../lib/tokens'
import { logAuthEvent, type AuthEventContext } from '../lib/audit'
import { UnauthorizedError } from '../lib/errors'
import type { GoogleUserInfo, AuthTokens } from '../types/auth'
import type { User } from '../types'

interface AuthResult {
  user: User
  tokens: AuthTokens
  refreshToken: string
  isNewUser: boolean  // Add this to distinguish login vs signup
}

export const authService = {
  async findOrCreateUser(
    googleUser: GoogleUserInfo,
    ctx: AuthEventContext  // Add context parameter
  ): Promise<AuthResult> {
    let isNewUser = false

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
      isNewUser = true

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

      // Log signup event
      await logAuthEvent(ctx, 'SIGNUP', userRecord.id, {
        email: userRecord.email,
        provider: 'google',
        accountId: accountRecord.id,
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

    // Log login event (for both new and existing users)
    await logAuthEvent(ctx, 'LOGIN', userRecord.id, {
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
        providerIds: userRecord.providerIds || [],
        isSuperAdmin: userRecord.isSuperAdmin,
        createdAt: userRecord.createdAt,
        updatedAt: userRecord.updatedAt,
        deletedAt: userRecord.deletedAt,
      },
      tokens: {
        accessToken,
        expiresIn: 60 * 15,
      },
      refreshToken,
      isNewUser,
    }
  },

  async refreshAccessToken(
    refreshToken: string,
    ctx: AuthEventContext  // Add context parameter
  ): Promise<AuthTokens> {
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

    // Log token refresh event
    await logAuthEvent(ctx, 'TOKEN_REFRESH', userRecord.id, {
      email: userRecord.email,
    })

    return {
      accessToken,
      expiresIn: 60 * 15,
    }
  },

  async revokeRefreshToken(
    refreshToken: string,
    ctx: AuthEventContext,  // Add context parameter
    userId: string | null   // Add userId for logging
  ): Promise<void> {
    const tokenHash = await hashToken(refreshToken)

    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.tokenHash, tokenHash))

    // Log logout event
    if (userId) {
      await logAuthEvent(ctx, 'LOGOUT', userId, {})
    }
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
```

**Step 2: Commit**

```bash
git add src/services/auth.ts
git commit -m "feat(audit): add audit logging to auth service methods"
```

---

## Task 4: Update Auth Handlers to Pass Context

**Files:**
- Modify: `src/routes/auth/handlers.ts`

**Step 1: Update handlers to pass AuthEventContext**

```typescript
// src/routes/auth/handlers.ts
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { HTTPException } from 'hono/http-exception'
import { env } from '../../env'
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
  buildGoogleAuthUrl,
  exchangeCodeForTokens,
  decodeIdToken,
} from '../../lib/oauth'
import { setCookieOptions, setOAuthStateCookieOptions } from '../../lib/tokens'
import { authService } from '../../services/auth'
import type { AuthEventContext } from '../../lib/audit'

const isProduction = env.NODE_ENV === 'production'

// Helper to extract auth context from Hono context
function getAuthContext(c: any): AuthEventContext {
  return {
    transactionId: c.get('transactionId') || crypto.randomUUID(),
    ip: c.get('ip') || 'unknown',
    userAgent: c.get('userAgent') || 'unknown',
  }
}

export const loginHandler = async (c: any) => {
  const { redirect } = c.req.valid('query')

  const codeVerifier = generateCodeVerifier()
  const codeChallenge = await generateCodeChallenge(codeVerifier)
  const state = generateState()

  const oauthData = JSON.stringify({
    codeVerifier,
    state,
    redirect: redirect || null,
  })

  setCookie(c, 'oauth_state', oauthData, setOAuthStateCookieOptions(isProduction))

  const authUrl = buildGoogleAuthUrl(state, codeChallenge)
  return c.redirect(authUrl)
}

export const callbackHandler = async (c: any) => {
  const { code, state } = c.req.valid('query')
  const ctx = getAuthContext(c)

  const oauthCookie = getCookie(c, 'oauth_state')
  if (!oauthCookie) {
    throw new HTTPException(400, { message: 'Missing OAuth state cookie' })
  }

  let oauthData: { codeVerifier: string; state: string; redirect: string | null }
  try {
    oauthData = JSON.parse(oauthCookie)
  } catch {
    throw new HTTPException(400, { message: 'Invalid OAuth state cookie' })
  }

  if (state !== oauthData.state) {
    throw new HTTPException(400, { message: 'Invalid state parameter' })
  }

  deleteCookie(c, 'oauth_state')

  const tokens = await exchangeCodeForTokens(code, oauthData.codeVerifier)
  const googleUser = decodeIdToken(tokens.id_token)

  // Pass context for audit logging
  const result = await authService.findOrCreateUser(googleUser, ctx)

  setCookie(c, 'refresh_token', result.refreshToken, setCookieOptions(isProduction))

  if (oauthData.redirect) {
    const redirectUrl = new URL(oauthData.redirect)
    redirectUrl.searchParams.set('token', result.tokens.accessToken)
    return c.redirect(redirectUrl.toString())
  }

  return c.json({
    user: result.user,
    tokens: result.tokens,
  })
}

export const refreshHandler = async (c: any) => {
  const refreshToken = getCookie(c, 'refresh_token')
  const ctx = getAuthContext(c)

  if (!refreshToken) {
    throw new HTTPException(401, { message: 'No refresh token' })
  }

  // Pass context for audit logging
  const tokens = await authService.refreshAccessToken(refreshToken, ctx)

  return c.json({ tokens })
}

export const logoutHandler = async (c: any) => {
  const refreshToken = getCookie(c, 'refresh_token')
  const ctx = getAuthContext(c)
  const user = c.get('user')

  if (refreshToken) {
    // Pass context and userId for audit logging
    await authService.revokeRefreshToken(refreshToken, ctx, user?.id || null)
  }

  deleteCookie(c, 'refresh_token')

  return c.json({ message: 'Logged out successfully' })
}

export const meHandler = async (c: any) => {
  const user = c.get('user')

  if (!user) {
    throw new HTTPException(401, { message: 'Not authenticated' })
  }

  return c.json({ user })
}
```

**Step 2: Commit**

```bash
git add src/routes/auth/handlers.ts
git commit -m "feat(audit): pass context to auth service for audit logging"
```

---

## Task 5: Verify Build and Test

**Step 1: Run TypeScript build**

```bash
npm run build
```

Expected: No errors

**Step 2: Test manually**

Start server and test:
- Login via `/auth/login` - should log LOGIN (and SIGNUP for new users)
- Refresh via `/auth/refresh` - should log TOKEN_REFRESH
- Logout via `/auth/logout` - should log LOGOUT

**Step 3: Query audit logs to verify**

```sql
SELECT * FROM audit_logs WHERE entity = 'Auth' ORDER BY timestamp DESC;
```

**Step 4: Final commit**

```bash
git add .
git commit -m "feat(audit): complete auth audit logging implementation"
```

---

## Summary

This plan implements:
1. Extended action types in audit_logs schema
2. New `logAuthEvent` function for auth-specific logging
3. Updated auth service to log: LOGIN, SIGNUP, LOGOUT, TOKEN_REFRESH
4. Updated handlers to pass request context (IP, user agent, transaction ID)

**Events logged:**
| Event | When | Details Captured |
|-------|------|------------------|
| SIGNUP | New user created | email, provider, accountId |
| LOGIN | User authenticates | email, provider, isNewUser |
| LOGOUT | User logs out | - |
| TOKEN_REFRESH | Access token refreshed | email |
