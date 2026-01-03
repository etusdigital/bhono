// src/server/routes/auth/test-login.ts
import type { RouteHandler } from '@hono/zod-openapi'
import { createRoute, z } from '@hono/zod-openapi'
import { eq } from 'drizzle-orm'
import { HTTPException } from 'hono/http-exception'
import { users, accounts, userAccounts, type UserRecord } from '../../db/schema'
import { createSession } from '../../lib/session'
import type { HonoEnv } from '../../types'

const TestLoginSchema = z.object({
  email: z.email(),
  name: z.string().optional(),
})

export const testLoginRoute = createRoute({
  method: 'post',
  path: '/test-login',
  tags: ['Auth'],
  summary: 'Test login endpoint (development only)',
  description:
    'Creates or finds a test user and establishes a session. Only available in development/test environments.',
  request: {
    body: {
      content: { 'application/json': { schema: TestLoginSchema } },
    },
  },
  responses: {
    200: {
      description: 'Login successful',
      content: {
        'application/json': {
          schema: z.object({
            user: z.object({
              id: z.string(),
              email: z.string(),
              name: z.string().nullable(),
            }),
            accountId: z.string().nullable().describe('The default account ID for API requests'),
          }),
        },
      },
    },
    403: {
      description: 'Not available in production',
      content: {
        'application/json': {
          schema: z.object({
            error: z.object({ message: z.string() }),
          }),
        },
      },
    },
  },
})

export const testLoginHandler: RouteHandler<typeof testLoginRoute, HonoEnv> = async (c) => {
  // Only allow in development/test
  const env = c.env
  if (env.ENVIRONMENT === 'production') {
    throw new HTTPException(403, { message: 'Not available in production' })
  }

  const { email, name } = c.req.valid('json')
  const db = c.get('db')

  if (!db) {
    throw new Error('Database not initialized')
  }

  // Find or create user
  const existingUsers = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  let user: UserRecord | undefined = existingUsers.at(0)
  let defaultAccountId: string | null = null

  if (user === undefined) {
    // Create test user
    const userId = crypto.randomUUID()
    const now = new Date().toISOString()

    await db.insert(users).values({
      id: userId,
      email,
      name: name ?? 'E2E Test User',
      googleId: `test-${userId}`,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    })

    const createdUsers = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    user = createdUsers.at(0)

    // Create a default account for the user
    defaultAccountId = crypto.randomUUID()
    await db.insert(accounts).values({
      id: defaultAccountId,
      name: `${name ?? 'Test'}'s Workspace`,
      createdAt: now,
      updatedAt: now,
    })

    // Link user to account as ADMIN
    await db.insert(userAccounts).values({
      userId,
      accountId: defaultAccountId,
      role: 'ADMIN',
    })
  } else {
    // Get the user's first account
    const userAccountResults = await db
      .select()
      .from(userAccounts)
      .where(eq(userAccounts.userId, user.id))
      .limit(1)

    const userAccount = userAccountResults.at(0)
    if (userAccount !== undefined) {
      defaultAccountId = userAccount.accountId
    }
  }

  if (user === undefined) {
    throw new Error('Failed to create or find user')
  }

  // Create session
  await createSession(c, {
    userId: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl ?? null,
    isSuperAdmin: user.isSuperAdmin,
  })

  return c.json(
    {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      accountId: defaultAccountId,
    },
    200
  )
}
