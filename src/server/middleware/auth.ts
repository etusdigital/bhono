// src/middleware/auth.ts
import { createMiddleware } from 'hono/factory'
import { verify } from 'hono/jwt'
import { HTTPException } from 'hono/http-exception'
import { users } from '../db/schema'
import { eq, and, isNull } from 'drizzle-orm'
import type { HonoEnv } from '../types'
import { getSession } from '../lib/session'

interface JWTPayload {
  sub: string
  email: string
  iat: number
  exp: number
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
  if (!db) {
    throw new HTTPException(500, { message: 'Database not initialized' })
  }
  const userResults = await db
    .select()
    .from(users)
    .where(and(eq(users.id, session.userId), isNull(users.deletedAt)))
    .limit(1)

  const user = userResults.at(0)
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
    providerIds: user.providerIds ?? [],
    isSuperAdmin: user.isSuperAdmin,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    deletedAt: user.deletedAt,
  })

  await next()
})

/**
 * JWT-based authentication middleware (legacy, kept for backward compatibility)
 * Use sessionAuth for new code
 */
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
    payload = (await verify(token, c.env.JWT_SECRET)) as unknown as JWTPayload
  } catch {
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
  const db = c.get('db')
  if (!db) {
    throw new HTTPException(500, { message: 'Database not initialized' })
  }
  const userResults = await db
    .select()
    .from(users)
    .where(and(eq(users.id, payload.sub), isNull(users.deletedAt)))
    .limit(1)

  const user = userResults.at(0)
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
    providerIds: user.providerIds ?? [],
    isSuperAdmin: user.isSuperAdmin,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    deletedAt: user.deletedAt,
  })

  await next()
})
