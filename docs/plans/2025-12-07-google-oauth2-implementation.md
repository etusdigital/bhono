# Google OAuth2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement Google OAuth2 authentication with PKCE flow, replacing the need for Auth0.

**Architecture:** Users authenticate via Google OAuth2 with PKCE. After validation, the backend issues its own JWT (15min) and refresh token (30 days in HTTP-only cookie). Users are identified by Google `sub` claim, with email as required secondary info.

**Tech Stack:** Hono, Drizzle ORM, SQLite, native crypto for PKCE/hashing, native fetch for Google token exchange.

---

## Task 1: Update Environment Schema

**Files:**
- Modify: `src/env.ts`

**Step 1: Add Google OAuth environment variables**

```typescript
// src/env.ts
import { z } from 'zod'

const envSchema = z.object({
  // Server
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Database
  DATABASE_URL: z.string().default('db.sqlite'),

  // JWT (required for auth)
  JWT_SECRET: z.string().min(32).default('development-secret-key-min-32-chars'),
  JWT_EXPIRY_MINUTES: z.coerce.number().default(15),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_REDIRECT_URI: z.string().url().default('http://localhost:3000/auth/callback'),

  // Refresh Token
  REFRESH_TOKEN_EXPIRY_DAYS: z.coerce.number().default(30),

  // Optional
  CORS_ORIGINS: z.string().default('*'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
})

export const env = envSchema.parse(process.env)
export type Env = z.infer<typeof envSchema>
```

**Step 2: Update .env.example**

Add to `.env.example`:
```
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback
JWT_EXPIRY_MINUTES=15
REFRESH_TOKEN_EXPIRY_DAYS=30
```

**Step 3: Commit**

```bash
git add src/env.ts .env.example
git commit -m "feat(auth): add Google OAuth environment variables"
```

---

## Task 2: Update Users Schema

**Files:**
- Modify: `src/db/schema/users.ts`

**Step 1: Add googleId and avatarUrl fields**

```typescript
// src/db/schema/users.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const users = sqliteTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  googleId: text('google_id').notNull().unique(),
  email: text('email').notNull(),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  status: text('status', { enum: ['active', 'inactive'] })
    .default('active')
    .notNull(),
  providerIds: text('provider_ids', { mode: 'json' })
    .$type<string[]>()
    .default([]),
  isSuperAdmin: integer('is_super_admin', { mode: 'boolean' })
    .default(false)
    .notNull(),

  // Soft delete + audit fields
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
  deletedAt: text('deleted_at'),
  createdById: text('created_by_id').references((): any => users.id),
  updatedById: text('updated_by_id').references((): any => users.id),
  deletedById: text('deleted_by_id').references((): any => users.id),
})

export type UserRecord = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
```

**Step 2: Commit**

```bash
git add src/db/schema/users.ts
git commit -m "feat(auth): add googleId and avatarUrl to users schema"
```

---

## Task 3: Create Refresh Tokens Schema

**Files:**
- Create: `src/db/schema/refresh-tokens.ts`
- Modify: `src/db/schema/index.ts`

**Step 1: Create refresh tokens table**

```typescript
// src/db/schema/refresh-tokens.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'
import { users } from './users'

export const refreshTokens = sqliteTable('refresh_tokens', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  revokedAt: integer('revoked_at', { mode: 'timestamp' }),
})

export type RefreshTokenRecord = typeof refreshTokens.$inferSelect
export type NewRefreshToken = typeof refreshTokens.$inferInsert
```

**Step 2: Export from schema index**

```typescript
// src/db/schema/index.ts
export * from './users'
export * from './accounts'
export * from './user-accounts'
export * from './audit-logs'
export * from './refresh-tokens'
```

**Step 3: Commit**

```bash
git add src/db/schema/refresh-tokens.ts src/db/schema/index.ts
git commit -m "feat(auth): add refresh tokens schema"
```

---

## Task 4: Create Auth Types

**Files:**
- Create: `src/types/auth.ts`
- Modify: `src/types/index.ts`

**Step 1: Create auth types file**

```typescript
// src/types/auth.ts
export interface GoogleTokenResponse {
  access_token: string
  expires_in: number
  id_token: string
  scope: string
  token_type: string
  refresh_token?: string
}

export interface GoogleUserInfo {
  sub: string
  email: string
  email_verified: boolean
  name: string
  picture?: string
  given_name?: string
  family_name?: string
}

export interface JWTPayload {
  sub: string
  email: string
  iat: number
  exp: number
}

export interface AuthTokens {
  accessToken: string
  expiresIn: number
}

export interface OAuthState {
  codeChallenge: string
  redirectUrl?: string
}
```

**Step 2: Export from types index**

```typescript
// src/types/index.ts - add at the end
export * from './auth'
```

**Step 3: Commit**

```bash
git add src/types/auth.ts src/types/index.ts
git commit -m "feat(auth): add auth types"
```

---

## Task 5: Create OAuth Helpers

**Files:**
- Create: `src/lib/oauth.ts`

**Step 1: Create OAuth helpers**

```typescript
// src/lib/oauth.ts
import { env } from '../env'
import type { GoogleTokenResponse, GoogleUserInfo } from '../types/auth'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo'

export function generateCodeVerifier(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return base64UrlEncode(array)
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return base64UrlEncode(new Uint8Array(hash))
}

export function generateState(): string {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return base64UrlEncode(array)
}

function base64UrlEncode(buffer: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...buffer))
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function buildGoogleAuthUrl(state: string, codeChallenge: string): string {
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: env.GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    access_type: 'offline',
    prompt: 'consent',
  })
  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}

export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string
): Promise<GoogleTokenResponse> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      code,
      code_verifier: codeVerifier,
      grant_type: 'authorization_code',
      redirect_uri: env.GOOGLE_REDIRECT_URI,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to exchange code: ${error}`)
  }

  return response.json()
}

export async function getGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw new Error('Failed to get user info from Google')
  }

  return response.json()
}

export function decodeIdToken(idToken: string): GoogleUserInfo {
  const parts = idToken.split('.')
  if (parts.length !== 3) {
    throw new Error('Invalid ID token format')
  }
  const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
  return {
    sub: payload.sub,
    email: payload.email,
    email_verified: payload.email_verified,
    name: payload.name,
    picture: payload.picture,
    given_name: payload.given_name,
    family_name: payload.family_name,
  }
}
```

**Step 2: Commit**

```bash
git add src/lib/oauth.ts
git commit -m "feat(auth): add Google OAuth helpers"
```

---

## Task 6: Create Token Utilities

**Files:**
- Create: `src/lib/tokens.ts`

**Step 1: Create token utilities**

```typescript
// src/lib/tokens.ts
import { sign } from 'hono/jwt'
import { env } from '../env'
import type { JWTPayload } from '../types/auth'

export async function createAccessToken(userId: string, email: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const payload: JWTPayload = {
    sub: userId,
    email,
    iat: now,
    exp: now + env.JWT_EXPIRY_MINUTES * 60,
  }
  return sign(payload, env.JWT_SECRET)
}

export function generateRefreshToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(token)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function getRefreshTokenExpiry(): Date {
  const now = new Date()
  now.setDate(now.getDate() + env.REFRESH_TOKEN_EXPIRY_DAYS)
  return now
}

export function setCookieOptions(isProduction: boolean) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'Lax' as const,
    path: '/',
    maxAge: env.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60,
  }
}

export function setOAuthStateCookieOptions(isProduction: boolean) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'Lax' as const,
    path: '/',
    maxAge: 10 * 60, // 10 minutes
  }
}
```

**Step 2: Commit**

```bash
git add src/lib/tokens.ts
git commit -m "feat(auth): add token utilities"
```

---

## Task 7: Create Auth Service

**Files:**
- Create: `src/services/auth.ts`

**Step 1: Create auth service**

```typescript
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
```

**Step 2: Export from services index**

Check if `src/services/index.ts` exists. If yes, add:

```typescript
export * from './auth'
```

If not, create it:

```typescript
// src/services/index.ts
export * from './users'
export * from './accounts'
export * from './auth'
```

**Step 3: Commit**

```bash
git add src/services/auth.ts src/services/index.ts
git commit -m "feat(auth): add auth service"
```

---

## Task 8: Create Auth Routes - Schemas

**Files:**
- Create: `src/routes/auth/schemas.ts`

**Step 1: Create auth schemas**

```typescript
// src/routes/auth/schemas.ts
import { z } from '@hono/zod-openapi'

export const AuthTokensSchema = z.object({
  accessToken: z.string(),
  expiresIn: z.number(),
})

export const AuthUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  avatarUrl: z.string().nullable().optional(),
  status: z.enum(['active', 'inactive']),
  isSuperAdmin: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const LoginQuerySchema = z.object({
  redirect: z.string().url().optional().openapi({
    description: 'URL to redirect after successful login',
  }),
})

export const CallbackQuerySchema = z.object({
  code: z.string().openapi({
    description: 'Authorization code from Google',
  }),
  state: z.string().openapi({
    description: 'State parameter for CSRF protection',
  }),
})

export const AuthErrorSchema = z.object({
  error: z.string(),
  statusCode: z.number(),
})
```

**Step 2: Commit**

```bash
git add src/routes/auth/schemas.ts
git commit -m "feat(auth): add auth route schemas"
```

---

## Task 9: Create Auth Routes - Route Definitions

**Files:**
- Create: `src/routes/auth/routes.ts`

**Step 1: Create route definitions**

```typescript
// src/routes/auth/routes.ts
import { createRoute, z } from '@hono/zod-openapi'
import {
  AuthTokensSchema,
  AuthUserSchema,
  LoginQuerySchema,
  CallbackQuerySchema,
  AuthErrorSchema,
} from './schemas'

export const loginRoute = createRoute({
  method: 'get',
  path: '/login',
  tags: ['Auth'],
  summary: 'Initiate Google OAuth login',
  description: 'Redirects to Google OAuth consent screen',
  request: {
    query: LoginQuerySchema,
  },
  responses: {
    302: {
      description: 'Redirect to Google OAuth',
    },
  },
})

export const callbackRoute = createRoute({
  method: 'get',
  path: '/callback',
  tags: ['Auth'],
  summary: 'Google OAuth callback',
  description: 'Handles Google OAuth callback and issues tokens',
  request: {
    query: CallbackQuerySchema,
  },
  responses: {
    200: {
      description: 'Authentication successful',
      content: {
        'application/json': {
          schema: z.object({
            user: AuthUserSchema,
            tokens: AuthTokensSchema,
          }),
        },
      },
    },
    400: {
      description: 'Invalid callback',
      content: { 'application/json': { schema: AuthErrorSchema } },
    },
  },
})

export const refreshRoute = createRoute({
  method: 'post',
  path: '/refresh',
  tags: ['Auth'],
  summary: 'Refresh access token',
  description: 'Uses refresh token from cookie to issue new access token',
  responses: {
    200: {
      description: 'Token refreshed',
      content: {
        'application/json': {
          schema: z.object({
            tokens: AuthTokensSchema,
          }),
        },
      },
    },
    401: {
      description: 'Invalid refresh token',
      content: { 'application/json': { schema: AuthErrorSchema } },
    },
  },
})

export const logoutRoute = createRoute({
  method: 'post',
  path: '/logout',
  tags: ['Auth'],
  summary: 'Logout user',
  description: 'Revokes refresh token and clears cookie',
  responses: {
    200: {
      description: 'Logged out successfully',
      content: {
        'application/json': {
          schema: z.object({
            message: z.string(),
          }),
        },
      },
    },
  },
})

export const meRoute = createRoute({
  method: 'get',
  path: '/me',
  tags: ['Auth'],
  summary: 'Get current user',
  description: 'Returns authenticated user info',
  security: [{ Bearer: [] }],
  responses: {
    200: {
      description: 'Current user info',
      content: {
        'application/json': {
          schema: z.object({
            user: AuthUserSchema,
          }),
        },
      },
    },
    401: {
      description: 'Not authenticated',
      content: { 'application/json': { schema: AuthErrorSchema } },
    },
  },
})
```

**Step 2: Commit**

```bash
git add src/routes/auth/routes.ts
git commit -m "feat(auth): add auth route definitions"
```

---

## Task 10: Create Auth Routes - Handlers

**Files:**
- Create: `src/routes/auth/handlers.ts`

**Step 1: Create handlers**

```typescript
// src/routes/auth/handlers.ts
import type { RouteHandler } from '@hono/zod-openapi'
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
import type {
  loginRoute,
  callbackRoute,
  refreshRoute,
  logoutRoute,
  meRoute,
} from './routes'

const isProduction = env.NODE_ENV === 'production'

export const loginHandler: RouteHandler<typeof loginRoute> = async (c) => {
  const { redirect } = c.req.valid('query')

  const codeVerifier = generateCodeVerifier()
  const codeChallenge = await generateCodeChallenge(codeVerifier)
  const state = generateState()

  // Store code verifier and state in cookie
  const oauthData = JSON.stringify({
    codeVerifier,
    state,
    redirect: redirect || null,
  })

  setCookie(c, 'oauth_state', oauthData, setOAuthStateCookieOptions(isProduction))

  const authUrl = buildGoogleAuthUrl(state, codeChallenge)
  return c.redirect(authUrl)
}

export const callbackHandler: RouteHandler<typeof callbackRoute> = async (c) => {
  const { code, state } = c.req.valid('query')

  // Get stored OAuth state
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

  // Validate state
  if (state !== oauthData.state) {
    throw new HTTPException(400, { message: 'Invalid state parameter' })
  }

  // Clear OAuth state cookie
  deleteCookie(c, 'oauth_state')

  // Exchange code for tokens
  const tokens = await exchangeCodeForTokens(code, oauthData.codeVerifier)

  // Decode ID token to get user info
  const googleUser = decodeIdToken(tokens.id_token)

  // Find or create user
  const result = await authService.findOrCreateUser(googleUser)

  // Set refresh token cookie
  setCookie(c, 'refresh_token', result.refreshToken, setCookieOptions(isProduction))

  // If redirect URL provided, redirect with token in query (for SPA)
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

export const refreshHandler: RouteHandler<typeof refreshRoute> = async (c) => {
  const refreshToken = getCookie(c, 'refresh_token')

  if (!refreshToken) {
    throw new HTTPException(401, { message: 'No refresh token' })
  }

  const tokens = await authService.refreshAccessToken(refreshToken)

  return c.json({ tokens })
}

export const logoutHandler: RouteHandler<typeof logoutRoute> = async (c) => {
  const refreshToken = getCookie(c, 'refresh_token')

  if (refreshToken) {
    await authService.revokeRefreshToken(refreshToken)
  }

  deleteCookie(c, 'refresh_token')

  return c.json({ message: 'Logged out successfully' })
}

export const meHandler: RouteHandler<typeof meRoute> = async (c) => {
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
git commit -m "feat(auth): add auth route handlers"
```

---

## Task 11: Create Auth Routes - Index

**Files:**
- Create: `src/routes/auth/index.ts`

**Step 1: Create auth router**

```typescript
// src/routes/auth/index.ts
import { OpenAPIHono } from '@hono/zod-openapi'
import type { HonoEnv } from '../../types'
import { jwtAuth } from '../../middleware'
import {
  loginRoute,
  callbackRoute,
  refreshRoute,
  logoutRoute,
  meRoute,
} from './routes'
import {
  loginHandler,
  callbackHandler,
  refreshHandler,
  logoutHandler,
  meHandler,
} from './handlers'

const auth = new OpenAPIHono<HonoEnv>()

// Public routes (no auth required)
auth.openapi(loginRoute, loginHandler)
auth.openapi(callbackRoute, callbackHandler)
auth.openapi(refreshRoute, refreshHandler)
auth.openapi(logoutRoute, logoutHandler)

// Protected route (requires JWT)
auth.use(meRoute.path, jwtAuth)
auth.openapi(meRoute, meHandler)

export { auth }
```

**Step 2: Commit**

```bash
git add src/routes/auth/index.ts
git commit -m "feat(auth): create auth router"
```

---

## Task 12: Mount Auth Routes

**Files:**
- Modify: `src/index.ts`

**Step 1: Import and mount auth routes**

```typescript
// src/index.ts
import { serve } from '@hono/node-server'
import { createApp } from './app'
import { api } from './routes'
import { auth } from './routes/auth'
import { env } from './env'
import { requestContext } from './middleware/request-context'

const app = createApp()

// Global middleware - applies to ALL routes including health check
app.use('*', requestContext)

// Mount auth routes (before API routes, no JWT required for most)
app.route('/auth', auth)

// Mount API routes (all require JWT + account-id)
app.route('/api', api)

// Health check endpoint (no auth required)
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

// Start server
const port = env.PORT
console.log(`🚀 Server starting on port ${port}`)
console.log(`📚 API docs available at http://localhost:${port}/api/swagger`)

serve({
  fetch: app.fetch,
  port,
})
```

**Step 2: Commit**

```bash
git add src/index.ts
git commit -m "feat(auth): mount auth routes"
```

---

## Task 13: Update JWT Auth Middleware

**Files:**
- Modify: `src/middleware/auth.ts`

**Step 1: Update to use user ID from JWT sub claim**

```typescript
// src/middleware/auth.ts
import { createMiddleware } from 'hono/factory'
import { verify } from 'hono/jwt'
import { HTTPException } from 'hono/http-exception'
import { db } from '../db/client'
import { users } from '../db/schema'
import { eq, and, isNull } from 'drizzle-orm'
import { env } from '../env'
import type { HonoEnv } from '../types'

interface JWTPayload {
  sub: string
  email: string
  iat: number
  exp: number
}

export const jwtAuth = createMiddleware<HonoEnv>(async (c, next) => {
  // Extract Bearer token from Authorization header
  const authHeader = c.req.header('Authorization')

  if (!authHeader) {
    throw new HTTPException(401, {
      message: 'Missing authorization header',
    })
  }

  const [scheme, token] = authHeader.split(' ')

  if (scheme !== 'Bearer' || !token) {
    throw new HTTPException(401, {
      message: 'Invalid authorization header format. Expected: Bearer <token>',
    })
  }

  // Verify JWT
  let payload: JWTPayload
  try {
    payload = (await verify(token, env.JWT_SECRET)) as JWTPayload
  } catch (error) {
    throw new HTTPException(401, {
      message: 'Invalid or expired token',
    })
  }

  if (!payload.sub) {
    throw new HTTPException(401, {
      message: 'Invalid token payload: missing sub',
    })
  }

  // Look up user in database by ID (from sub claim)
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, payload.sub), isNull(users.deletedAt)))
    .limit(1)

  if (!user) {
    throw new HTTPException(401, {
      message: 'User not found',
    })
  }

  if (user.status !== 'active') {
    throw new HTTPException(401, {
      message: 'User account is not active',
    })
  }

  // Set user in context
  c.set('user', {
    id: user.id,
    email: user.email,
    name: user.name,
    status: user.status,
    providerIds: user.providerIds || [],
    isSuperAdmin: user.isSuperAdmin,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    deletedAt: user.deletedAt,
  })

  await next()
})
```

**Step 2: Commit**

```bash
git add src/middleware/auth.ts
git commit -m "feat(auth): update JWT middleware to use sub claim"
```

---

## Task 14: Update User Type

**Files:**
- Modify: `src/types/index.ts`

**Step 1: Add avatarUrl to User interface**

```typescript
// In src/types/index.ts, update the User interface:
export interface User {
  id: string
  email: string
  name: string
  avatarUrl?: string | null
  status: 'active' | 'inactive'
  providerIds: string[]
  isSuperAdmin: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}
```

**Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(auth): add avatarUrl to User type"
```

---

## Task 15: Run Database Migration

**Step 1: Generate migration**

```bash
npm run db:generate
```

**Step 2: Apply migration**

```bash
npm run db:push
```

**Step 3: Commit migration files**

```bash
git add drizzle/
git commit -m "chore(db): add google oauth migration"
```

---

## Task 16: Update .env.example and Test

**Step 1: Verify .env.example has all variables**

```
PORT=3000
NODE_ENV=development
DATABASE_URL=db.sqlite
JWT_SECRET=your-super-secret-jwt-key-at-least-32-chars
JWT_EXPIRY_MINUTES=15
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback
REFRESH_TOKEN_EXPIRY_DAYS=30
CORS_ORIGINS=*
LOG_LEVEL=info
```

**Step 2: Start server and test**

```bash
npm run dev
```

**Step 3: Test endpoints**

- Visit `http://localhost:3000/auth/login` - should redirect to Google
- After Google auth, callback should return tokens
- Test `POST /auth/refresh` with cookie
- Test `POST /auth/logout`
- Test `GET /auth/me` with JWT

**Step 4: Final commit**

```bash
git add .
git commit -m "feat(auth): complete Google OAuth2 implementation"
```

---

## Summary

This plan implements:
1. Environment variables for Google OAuth
2. Database schema changes (googleId, avatarUrl, refresh_tokens table)
3. OAuth helpers (PKCE, token exchange)
4. Token utilities (JWT creation, refresh token management)
5. Auth service (user creation, token refresh, logout)
6. Auth routes (login, callback, refresh, logout, me)
7. Updated JWT middleware

All tasks follow TDD principles where applicable and include frequent commits.
