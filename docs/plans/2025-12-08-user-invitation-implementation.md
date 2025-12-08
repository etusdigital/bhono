# User Invitation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement user invitation flow allowing ADMIN/MANAGER to invite users to accounts.

**Architecture:** Existing users are linked immediately; new users receive email invitations via SendGrid. Invitations expire after 7 days and are accepted during OAuth callback.

**Tech Stack:** Hono, Drizzle ORM, SQLite, SendGrid for email, existing auth flow.

---

## Task 1: Update Environment Schema

**Files:**
- Modify: `src/env.ts`
- Modify: `.env.example`

**Step 1: Add SendGrid and APP_URL environment variables**

```typescript
// src/env.ts - add to envSchema object
const envSchema = z.object({
  // ... existing fields ...

  // SendGrid (for invitations)
  SENDGRID_API_KEY: z.string().min(1),
  SENDGRID_FROM_EMAIL: z.string().email(),

  // App URL (for invitation links)
  APP_URL: z.string().url().default('http://localhost:3000'),

  // ... rest of existing fields ...
})
```

**Step 2: Update .env.example**

Add:
```
# SendGrid (for invitations)
SENDGRID_API_KEY=your-sendgrid-api-key
SENDGRID_FROM_EMAIL=noreply@yourdomain.com

# App URL
APP_URL=http://localhost:3000
```

**Step 3: Commit**

```bash
git add src/env.ts .env.example
git commit -m "feat(invitations): add SendGrid environment variables"
```

---

## Task 2: Create Invitations Schema

**Files:**
- Create: `src/db/schema/invitations.ts`
- Modify: `src/db/schema/index.ts`

**Step 1: Create invitations table**

```typescript
// src/db/schema/invitations.ts
import { sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'
import { accounts } from './accounts'
import { users } from './users'

export const invitations = sqliteTable('invitations', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  accountId: text('account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  role: text('role', {
    enum: ['ADMIN', 'MANAGER', 'EDITOR', 'AUTHOR', 'VIEWER', 'BILLING', 'ANALYTICS'],
  }).notNull(),
  token: text('token').notNull().unique(),
  invitedById: text('invited_by_id')
    .notNull()
    .references(() => users.id),
  expiresAt: text('expires_at').notNull(),
  acceptedAt: text('accepted_at'),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
}, (table) => ({
  accountEmailIdx: uniqueIndex('account_email_idx').on(table.accountId, table.email),
}))

export type InvitationRecord = typeof invitations.$inferSelect
export type NewInvitation = typeof invitations.$inferInsert
```

**Step 2: Export from schema index**

```typescript
// src/db/schema/index.ts - add at end
export * from './invitations'
```

**Step 3: Commit**

```bash
git add src/db/schema/invitations.ts src/db/schema/index.ts
git commit -m "feat(invitations): add invitations schema"
```

---

## Task 3: Create Email Service

**Files:**
- Create: `src/lib/email.ts`

**Step 1: Create SendGrid email service**

```typescript
// src/lib/email.ts
import { env } from '../env'

interface SendEmailOptions {
  to: string
  subject: string
  text: string
  html: string
}

async function sendEmail(options: SendEmailOptions): Promise<void> {
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: options.to }] }],
      from: { email: env.SENDGRID_FROM_EMAIL },
      subject: options.subject,
      content: [
        { type: 'text/plain', value: options.text },
        { type: 'text/html', value: options.html },
      ],
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to send email: ${error}`)
  }
}

export async function sendInvitationEmail(
  to: string,
  inviterName: string,
  accountName: string,
  inviteUrl: string
): Promise<void> {
  const subject = `${inviterName} invited you to join "${accountName}"`

  const text = `
Hi,

${inviterName} has invited you to join "${accountName}".

Click the link below to accept the invitation:
${inviteUrl}

This invitation expires in 7 days.

If you didn't expect this invitation, you can ignore this email.
`.trim()

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .button { display: inline-block; padding: 12px 24px; background-color: #0070f3; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { margin-top: 30px; font-size: 14px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <p>Hi,</p>
    <p><strong>${inviterName}</strong> has invited you to join <strong>"${accountName}"</strong>.</p>
    <a href="${inviteUrl}" class="button">Accept Invitation</a>
    <p>Or copy this link: ${inviteUrl}</p>
    <p class="footer">This invitation expires in 7 days.<br>If you didn't expect this invitation, you can ignore this email.</p>
  </div>
</body>
</html>
`.trim()

  await sendEmail({ to, subject, text, html })
}
```

**Step 2: Commit**

```bash
git add src/lib/email.ts
git commit -m "feat(invitations): add SendGrid email service"
```

---

## Task 4: Create Invitation Service

**Files:**
- Create: `src/services/invitations.ts`
- Modify: `src/services/index.ts`

**Step 1: Create invitation service**

```typescript
// src/services/invitations.ts
import { eq, and, isNull, gt } from 'drizzle-orm'
import { db } from '../db/client'
import { invitations, users, userAccounts, accounts } from '../db/schema'
import { sendInvitationEmail } from '../lib/email'
import { logAuthEvent, type AuthEventContext } from '../lib/audit'
import { ConflictError, NotFoundError, ForbiddenError } from '../lib/errors'
import { env } from '../env'
import { hasMinimumRole, type Role } from '../auth/roles'
import type { ServiceContext } from '../types'

function generateToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function getExpiryDate(): string {
  const date = new Date()
  date.setDate(date.getDate() + 7)
  return date.toISOString()
}

interface CreateInvitationInput {
  email: string
  role: Role
}

interface InvitationResult {
  linked: boolean
  invited: boolean
  user?: {
    id: string
    email: string
    name: string
  }
  invitation?: {
    id: string
    email: string
    role: Role
    expiresAt: string
  }
}

export const invitationsService = {
  async create(ctx: ServiceContext, input: CreateInvitationInput): Promise<InvitationResult> {
    const { email, role } = input

    // Check inviter can assign this role (can't assign higher than own role)
    if (!hasMinimumRole(ctx.userRole!, role)) {
      throw new ForbiddenError('Cannot assign a role higher than your own')
    }

    // Check if user already in this account
    const [existingMembership] = await db
      .select()
      .from(userAccounts)
      .innerJoin(users, eq(users.id, userAccounts.userId))
      .where(
        and(
          eq(userAccounts.accountId, ctx.accountId),
          eq(users.email, email),
          isNull(users.deletedAt)
        )
      )
      .limit(1)

    if (existingMembership) {
      throw new ConflictError('User is already a member of this account')
    }

    // Check if user exists in system
    const [existingUser] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .limit(1)

    if (existingUser) {
      // Link immediately
      await db.insert(userAccounts).values({
        userId: existingUser.id,
        accountId: ctx.accountId,
        role,
      })

      return {
        linked: true,
        invited: false,
        user: {
          id: existingUser.id,
          email: existingUser.email,
          name: existingUser.name,
        },
      }
    }

    // Check for existing pending invitation
    const [existingInvitation] = await db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.accountId, ctx.accountId),
          eq(invitations.email, email),
          isNull(invitations.acceptedAt),
          gt(invitations.expiresAt, new Date().toISOString())
        )
      )
      .limit(1)

    if (existingInvitation) {
      throw new ConflictError('Pending invitation already exists for this email')
    }

    // Get account name for email
    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, ctx.accountId))
      .limit(1)

    // Create invitation
    const token = generateToken()
    const expiresAt = getExpiryDate()

    const [invitation] = await db
      .insert(invitations)
      .values({
        accountId: ctx.accountId,
        email,
        role,
        token,
        invitedById: ctx.user.id,
        expiresAt,
      })
      .returning()

    // Send email
    const inviteUrl = `${env.APP_URL}/auth/invite/${token}`
    await sendInvitationEmail(email, ctx.user.name, account!.name, inviteUrl)

    return {
      linked: false,
      invited: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role as Role,
        expiresAt: invitation.expiresAt,
      },
    }
  },

  async list(ctx: ServiceContext): Promise<Array<{
    id: string
    email: string
    role: Role
    invitedBy: { id: string; name: string }
    expiresAt: string
    createdAt: string
  }>> {
    const results = await db
      .select({
        id: invitations.id,
        email: invitations.email,
        role: invitations.role,
        expiresAt: invitations.expiresAt,
        createdAt: invitations.createdAt,
        invitedById: invitations.invitedById,
        inviterName: users.name,
      })
      .from(invitations)
      .innerJoin(users, eq(users.id, invitations.invitedById))
      .where(
        and(
          eq(invitations.accountId, ctx.accountId),
          isNull(invitations.acceptedAt),
          gt(invitations.expiresAt, new Date().toISOString())
        )
      )
      .orderBy(invitations.createdAt)

    return results.map((r) => ({
      id: r.id,
      email: r.email,
      role: r.role as Role,
      invitedBy: { id: r.invitedById, name: r.inviterName },
      expiresAt: r.expiresAt,
      createdAt: r.createdAt,
    }))
  },

  async revoke(ctx: ServiceContext, id: string): Promise<void> {
    const [invitation] = await db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.id, id),
          eq(invitations.accountId, ctx.accountId),
          isNull(invitations.acceptedAt)
        )
      )
      .limit(1)

    if (!invitation) {
      throw new NotFoundError('Invitation')
    }

    await db.delete(invitations).where(eq(invitations.id, id))
  },

  async getByToken(token: string): Promise<{
    id: string
    accountId: string
    email: string
    role: Role
    accountName: string
  } | null> {
    const [result] = await db
      .select({
        id: invitations.id,
        accountId: invitations.accountId,
        email: invitations.email,
        role: invitations.role,
        expiresAt: invitations.expiresAt,
        acceptedAt: invitations.acceptedAt,
        accountName: accounts.name,
      })
      .from(invitations)
      .innerJoin(accounts, eq(accounts.id, invitations.accountId))
      .where(eq(invitations.token, token))
      .limit(1)

    if (!result) return null
    if (result.acceptedAt) return null
    if (new Date(result.expiresAt) < new Date()) return null

    return {
      id: result.id,
      accountId: result.accountId,
      email: result.email,
      role: result.role as Role,
      accountName: result.accountName,
    }
  },

  async accept(
    invitationId: string,
    userId: string,
    ctx: AuthEventContext
  ): Promise<void> {
    const [invitation] = await db
      .select()
      .from(invitations)
      .where(eq(invitations.id, invitationId))
      .limit(1)

    if (!invitation) {
      throw new NotFoundError('Invitation')
    }

    // Create user-account relationship
    await db.insert(userAccounts).values({
      userId,
      accountId: invitation.accountId,
      role: invitation.role,
    })

    // Mark invitation as accepted
    await db
      .update(invitations)
      .set({ acceptedAt: new Date().toISOString() })
      .where(eq(invitations.id, invitationId))

    // Log event
    await logAuthEvent(ctx, 'LOGIN', userId, {
      invitationAccepted: true,
      accountId: invitation.accountId,
      role: invitation.role,
    })
  },
}
```

**Step 2: Export from services index**

```typescript
// src/services/index.ts - add at end
export * from './invitations'
```

**Step 3: Commit**

```bash
git add src/services/invitations.ts src/services/index.ts
git commit -m "feat(invitations): add invitation service"
```

---

## Task 5: Create Invitation Routes - Schemas

**Files:**
- Create: `src/routes/invitations/schemas.ts`

**Step 1: Create schemas**

```typescript
// src/routes/invitations/schemas.ts
import { z } from '@hono/zod-openapi'

export const CreateInvitationSchema = z.object({
  email: z.string().email().openapi({ description: 'Email address to invite' }),
  role: z.enum(['ADMIN', 'MANAGER', 'EDITOR', 'AUTHOR', 'VIEWER', 'BILLING', 'ANALYTICS']).openapi({
    description: 'Role to assign (cannot exceed your own role)',
  }),
})

export const InvitationSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  role: z.string(),
  expiresAt: z.string(),
  createdAt: z.string(),
  invitedBy: z.object({
    id: z.string(),
    name: z.string(),
  }),
})

export const InvitationResultSchema = z.object({
  linked: z.boolean(),
  invited: z.boolean(),
  user: z.object({
    id: z.string(),
    email: z.string(),
    name: z.string(),
  }).optional(),
  invitation: z.object({
    id: z.string(),
    email: z.string(),
    role: z.string(),
    expiresAt: z.string(),
  }).optional(),
})

export const InvitationsListSchema = z.array(InvitationSchema)
```

**Step 2: Commit**

```bash
git add src/routes/invitations/schemas.ts
git commit -m "feat(invitations): add invitation route schemas"
```

---

## Task 6: Create Invitation Routes - Route Definitions

**Files:**
- Create: `src/routes/invitations/routes.ts`

**Step 1: Create route definitions**

```typescript
// src/routes/invitations/routes.ts
import { createRoute, z } from '@hono/zod-openapi'
import {
  CreateInvitationSchema,
  InvitationResultSchema,
  InvitationsListSchema,
} from './schemas'
import { ErrorResponseSchema, IdParamSchema } from '../schemas'

export const createInvitationRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Invitations'],
  summary: 'Create invitation or link existing user',
  description: 'Invites a new user via email or links an existing user immediately',
  request: {
    body: {
      content: { 'application/json': { schema: CreateInvitationSchema } },
    },
  },
  responses: {
    200: {
      description: 'User linked or invitation sent',
      content: { 'application/json': { schema: InvitationResultSchema } },
    },
    403: {
      description: 'Cannot assign role higher than own',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    409: {
      description: 'User already in account or pending invitation exists',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

export const listInvitationsRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Invitations'],
  summary: 'List pending invitations',
  description: 'Lists all pending (not accepted, not expired) invitations for the account',
  responses: {
    200: {
      description: 'List of pending invitations',
      content: { 'application/json': { schema: z.object({ data: InvitationsListSchema }) } },
    },
  },
})

export const revokeInvitationRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['Invitations'],
  summary: 'Revoke invitation',
  description: 'Cancels a pending invitation',
  request: {
    params: IdParamSchema,
  },
  responses: {
    204: {
      description: 'Invitation revoked',
    },
    404: {
      description: 'Invitation not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})
```

**Step 2: Commit**

```bash
git add src/routes/invitations/routes.ts
git commit -m "feat(invitations): add invitation route definitions"
```

---

## Task 7: Create Invitation Routes - Handlers

**Files:**
- Create: `src/routes/invitations/handlers.ts`

**Step 1: Create handlers**

```typescript
// src/routes/invitations/handlers.ts
import { invitationsService } from '../../services/invitations'
import type { ServiceContext } from '../../types'

function getServiceContext(c: any): ServiceContext {
  return {
    accountId: c.get('accountId'),
    user: c.get('user'),
    userRole: c.get('userRole'),
    transactionId: c.get('transactionId'),
    ip: c.get('ip'),
    userAgent: c.get('userAgent'),
  }
}

export const createInvitationHandler = async (c: any) => {
  const body = c.req.valid('json')
  const ctx = getServiceContext(c)

  const result = await invitationsService.create(ctx, body)

  return c.json(result, 200)
}

export const listInvitationsHandler = async (c: any) => {
  const ctx = getServiceContext(c)

  const invitations = await invitationsService.list(ctx)

  return c.json({ data: invitations }, 200)
}

export const revokeInvitationHandler = async (c: any) => {
  const { id } = c.req.valid('param')
  const ctx = getServiceContext(c)

  await invitationsService.revoke(ctx, id)

  return c.body(null, 204)
}
```

**Step 2: Commit**

```bash
git add src/routes/invitations/handlers.ts
git commit -m "feat(invitations): add invitation route handlers"
```

---

## Task 8: Create Invitation Routes - Router Index

**Files:**
- Create: `src/routes/invitations/index.ts`

**Step 1: Create router**

```typescript
// src/routes/invitations/index.ts
import { OpenAPIHono } from '@hono/zod-openapi'
import type { HonoEnv } from '../../types'
import { requireRole } from '../../auth/guards'
import {
  createInvitationRoute,
  listInvitationsRoute,
  revokeInvitationRoute,
} from './routes'
import {
  createInvitationHandler,
  listInvitationsHandler,
  revokeInvitationHandler,
} from './handlers'

const invitationsRouter = new OpenAPIHono<HonoEnv>()

// All routes require MANAGER or ADMIN
invitationsRouter.use('/*', requireRole('MANAGER'))

invitationsRouter.openapi(createInvitationRoute, createInvitationHandler)
invitationsRouter.openapi(listInvitationsRoute, listInvitationsHandler)
invitationsRouter.openapi(revokeInvitationRoute, revokeInvitationHandler)

export { invitationsRouter }
```

**Step 2: Commit**

```bash
git add src/routes/invitations/index.ts
git commit -m "feat(invitations): create invitation router"
```

---

## Task 9: Mount Invitation Routes

**Files:**
- Modify: `src/routes/index.ts`

**Step 1: Import and mount invitations router**

Add import:
```typescript
import { invitationsRouter } from './invitations'
```

Add mount (after users and accounts):
```typescript
api.route('/invitations', invitationsRouter)
```

**Step 2: Commit**

```bash
git add src/routes/index.ts
git commit -m "feat(invitations): mount invitation routes"
```

---

## Task 10: Add Invite Accept Route to Auth

**Files:**
- Modify: `src/routes/auth/routes.ts`
- Modify: `src/routes/auth/handlers.ts`
- Modify: `src/routes/auth/index.ts`

**Step 1: Add invite route definition**

In `src/routes/auth/routes.ts`, add:

```typescript
export const inviteRoute = createRoute({
  method: 'get',
  path: '/invite/{token}',
  tags: ['Auth'],
  summary: 'Accept invitation',
  description: 'Validates invitation token and redirects to OAuth login',
  request: {
    params: z.object({
      token: z.string().openapi({ description: 'Invitation token' }),
    }),
  },
  responses: {
    302: {
      description: 'Redirect to login',
    },
    400: {
      description: 'Invalid or expired invitation',
      content: { 'application/json': { schema: AuthErrorSchema } },
    },
  },
})
```

**Step 2: Add invite handler**

In `src/routes/auth/handlers.ts`, add:

```typescript
import { invitationsService } from '../../services/invitations'

export const inviteHandler = async (c: any) => {
  const { token } = c.req.valid('param')

  // Validate invitation
  const invitation = await invitationsService.getByToken(token)

  if (!invitation) {
    throw new HTTPException(400, { message: 'Invalid or expired invitation' })
  }

  // Store invitation token in cookie
  setCookie(c, 'pending_invitation', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'Lax',
    path: '/',
    maxAge: 60 * 60, // 1 hour
  })

  // Redirect to login
  return c.redirect('/auth/login')
}
```

**Step 3: Register route**

In `src/routes/auth/index.ts`, add:

```typescript
import { inviteRoute } from './routes'
import { inviteHandler } from './handlers'

// Add before meRoute
auth.openapi(inviteRoute, inviteHandler)
```

**Step 4: Commit**

```bash
git add src/routes/auth/routes.ts src/routes/auth/handlers.ts src/routes/auth/index.ts
git commit -m "feat(invitations): add invite accept route"
```

---

## Task 11: Handle Pending Invitation in OAuth Callback

**Files:**
- Modify: `src/routes/auth/handlers.ts`

**Step 1: Update callbackHandler to check for pending invitation**

In `callbackHandler`, after `authService.findOrCreateUser(googleUser, ctx)`, add:

```typescript
// Check for pending invitation
const pendingInvitation = getCookie(c, 'pending_invitation')
if (pendingInvitation) {
  deleteCookie(c, 'pending_invitation')

  const invitation = await invitationsService.getByToken(pendingInvitation)
  if (invitation) {
    await invitationsService.accept(invitation.id, result.user.id, ctx)
  }
}
```

Add the import at top:
```typescript
import { invitationsService } from '../../services/invitations'
```

**Step 2: Commit**

```bash
git add src/routes/auth/handlers.ts
git commit -m "feat(invitations): handle pending invitation in OAuth callback"
```

---

## Task 12: Run Database Migration and Verify

**Step 1: Generate migration**

```bash
npm run db:generate
```

**Step 2: Apply migration**

```bash
npm run db:push --force
```

**Step 3: Build and verify**

```bash
npm run build
```

**Step 4: Commit migration**

```bash
git add drizzle/
git commit -m "chore(db): add invitations migration"
```

**Step 5: Final commit**

```bash
git add .
git commit -m "feat(invitations): complete user invitation implementation"
```

---

## Summary

This plan implements:
1. Environment variables for SendGrid
2. Invitations database schema
3. Email service for SendGrid
4. Invitation service with create/list/revoke/accept
5. Invitation API routes (POST, GET, DELETE)
6. Invite accept route (/auth/invite/{token})
7. Pending invitation handling in OAuth callback

**API Endpoints:**
- `POST /api/invitations` - Create invitation or link existing user
- `GET /api/invitations` - List pending invitations
- `DELETE /api/invitations/{id}` - Revoke invitation
- `GET /auth/invite/{token}` - Accept invitation (redirects to OAuth)
