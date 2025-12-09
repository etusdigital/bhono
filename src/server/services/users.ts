// src/services/users.ts
import { eq, and, isNull, like, sql } from 'drizzle-orm'
import type { Database } from '../db/client'
import { users, userAccounts } from '../db/schema'
import { logAudit } from '../lib/audit'
import { createPaginationMeta, calculateOffset } from '../lib/pagination'
import { NotFoundError, ConflictError } from '../lib/errors'
import type { ServiceContext, PaginationQuery, PaginatedResponse, User } from '../types'
import type { Role } from '../auth/roles'

interface CreateUserInput {
  email: string
  name: string
  role: Role
}

interface UpdateUserInput {
  name?: string
  status?: 'active' | 'inactive'
}

export const usersService = {
  async findAll(
    db: Database,
    ctx: ServiceContext,
    pagination: PaginationQuery
  ): Promise<PaginatedResponse<User>> {
    const offset = calculateOffset(pagination.page, pagination.limit)

    // Build base query conditions
    const conditions = [isNull(users.deletedAt)]

    // Non-super-admin sees only users in their account
    if (!ctx.user.isSuperAdmin) {
      const userIdsInAccount = db
        .select({ userId: userAccounts.userId })
        .from(userAccounts)
        .where(eq(userAccounts.accountId, ctx.accountId))

      conditions.push(sql`${users.id} IN ${userIdsInAccount}`)
    }

    // Add search filter if provided
    if (pagination.query) {
      conditions.push(
        sql`(${users.email} LIKE ${'%' + pagination.query + '%'} OR ${users.name} LIKE ${'%' + pagination.query + '%'})`
      )
    }

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(and(...conditions))

    const totalItems = countResult?.count ?? 0

    // Get paginated data
    const data = await db
      .select()
      .from(users)
      .where(and(...conditions))
      .limit(pagination.limit)
      .offset(offset)
      .orderBy(sql`${users.createdAt} DESC`)

    return {
      data: data.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        status: u.status,
        providerIds: u.providerIds || [],
        isSuperAdmin: u.isSuperAdmin,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        deletedAt: u.deletedAt,
      })),
      meta: createPaginationMeta(totalItems, pagination.page, pagination.limit),
    }
  },

  async findById(db: Database, ctx: ServiceContext, id: string): Promise<User> {
    const [userRecord] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .limit(1)

    if (!userRecord) {
      throw new NotFoundError('User')
    }

    // Check user has access (super-admin or same account)
    if (!ctx.user.isSuperAdmin) {
      const [membership] = await db
        .select()
        .from(userAccounts)
        .where(
          and(
            eq(userAccounts.userId, id),
            eq(userAccounts.accountId, ctx.accountId)
          )
        )
        .limit(1)

      if (!membership) {
        throw new NotFoundError('User')
      }
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

  // NOTE: User creation is disabled - users should only be created through Google OAuth
  // If you need to manually create users, add googleId to the CreateUserInput interface
  // and ensure the googleId is provided when creating users.
  /*
  async create(ctx: ServiceContext, input: CreateUserInput): Promise<User> {
    // Check email doesn't already exist
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1)

    if (existing) {
      throw new ConflictError('User with this email already exists')
    }

    // Create user
    const [userRecord] = await db
      .insert(users)
      .values({
        email: input.email,
        name: input.name,
        status: 'active',
        createdById: ctx.user.id,
        updatedById: ctx.user.id,
      })
      .returning()

    // Create user-account relationship
    await db.insert(userAccounts).values({
      userId: userRecord.id,
      accountId: ctx.accountId,
      role: input.role,
    })

    // Log audit
    await logAudit(ctx, 'User', userRecord.id, 'INSERT', userRecord)

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
  */

  async update(db: Database, ctx: ServiceContext, id: string, input: UpdateUserInput): Promise<User> {
    // Verify user exists and accessible
    await this.findById(db, ctx, id)

    // Update user
    const [userRecord] = await db
      .update(users)
      .set({
        ...input,
        updatedAt: new Date().toISOString(),
        updatedById: ctx.user.id,
      })
      .where(eq(users.id, id))
      .returning()

    // Log audit
    await logAudit(ctx, 'User', id, 'UPDATE', input as Record<string, unknown>)

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

  async delete(db: Database, ctx: ServiceContext, id: string): Promise<void> {
    // Verify user exists and accessible
    await this.findById(db, ctx, id)

    // Soft delete
    await db
      .update(users)
      .set({
        deletedAt: new Date().toISOString(),
        deletedById: ctx.user.id,
        updatedAt: new Date().toISOString(),
        updatedById: ctx.user.id,
      })
      .where(eq(users.id, id))

    // Log audit
    await logAudit(ctx, 'User', id, 'DELETE', { deleted: true })
  },
}
