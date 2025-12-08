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
