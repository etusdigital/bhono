// src/server/routes/auth/test-login.ts
import { createRoute, z } from '@hono/zod-openapi'
import { eq } from 'drizzle-orm'
import { users, accounts, userAccounts } from '../../db/schema'
import { createSession } from '../../lib/session'

const TestLoginSchema = z.object({
  email: z.string().email(),
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
            accountId: z.string().describe('The default account ID for API requests'),
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

// Note: Handler types are inferred from route definitions by @hono/zod-openapi
// Using 'any' is the standard pattern for openapi handlers
export async function testLoginHandler(c: any) {
  // Only allow in development/test
  const env = c.env
  if (env.ENVIRONMENT === 'production') {
    return c.json({ error: { message: 'Not available in production' } }, 403)
  }

  const { email, name } = c.req.valid('json')
  const db = c.get('db')

  // Find or create user
  let user = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1)
    .then((rows: any[]) => rows[0])

  let defaultAccountId: string | null = null

  if (!user) {
    // Create test user
    const userId = crypto.randomUUID()
    const now = new Date().toISOString()

    await db.insert(users).values({
      id: userId,
      email,
      name: name || 'E2E Test User',
      googleId: `test-${userId}`,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    })

    user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
      .then((rows: any[]) => rows[0])

    // Create a default account for the user
    defaultAccountId = crypto.randomUUID()
    await db.insert(accounts).values({
      id: defaultAccountId,
      name: `${name || 'Test'}'s Workspace`,
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
    const userAccount = await db
      .select()
      .from(userAccounts)
      .where(eq(userAccounts.userId, user.id))
      .limit(1)
      .then((rows: any[]) => rows[0])

    if (userAccount) {
      defaultAccountId = userAccount.accountId
    }
  }

  // Create session
  await createSession(c, {
    userId: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl || null,
    isSuperAdmin: user.isSuperAdmin || false,
  })

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    accountId: defaultAccountId,
  })
}
