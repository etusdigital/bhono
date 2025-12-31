// src/services/users.ts
import { eq, and, isNull, isNotNull, like, sql } from 'drizzle-orm'
import type { Database } from '../db/client'
import { users, userAccounts } from '../db/schema'
import { logAudit } from '../lib/audit'
import { auditedUpdate, auditedDelete } from '../lib/audited-db'
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
    await logAudit(db, ctx, 'User', userRecord.id, 'INSERT', userRecord)

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

    // Update user with audit
    const [userRecord] = await auditedUpdate(
      db,
      ctx,
      users,
      {
        ...input,
        updatedAt: new Date().toISOString(),
        updatedById: ctx.user.id,
      },
      eq(users.id, id)
    )

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

    // Soft delete with audit
    await auditedDelete(db, ctx, users, eq(users.id, id))
  },

  // Bulk User-Account Operations
  async createUserAccounts(
    db: Database,
    ctx: ServiceContext,
    items: Array<{ userId: string; accountId: string; role: Role }>
  ): Promise<{ success: boolean; count: number }> {
    let count = 0

    for (const item of items) {
      // Check if relationship already exists
      const [existing] = await db
        .select()
        .from(userAccounts)
        .where(
          and(
            eq(userAccounts.userId, item.userId),
            eq(userAccounts.accountId, item.accountId)
          )
        )
        .limit(1)

      if (existing) {
        // Update existing role
        await db
          .update(userAccounts)
          .set({ role: item.role })
          .where(
            and(
              eq(userAccounts.userId, item.userId),
              eq(userAccounts.accountId, item.accountId)
            )
          )
      } else {
        // Create new relationship
        await db.insert(userAccounts).values({
          userId: item.userId,
          accountId: item.accountId,
          role: item.role,
        })
      }

      count++

      // Log audit
      await logAudit(db, ctx, 'UserAccount', `${item.userId}-${item.accountId}`, 'INSERT', {
        userId: item.userId,
        accountId: item.accountId,
        role: item.role,
      })
    }

    return { success: true, count }
  },

  async deleteUserAccounts(
    db: Database,
    ctx: ServiceContext,
    items: Array<{ userId: string; accountId: string; role: Role }>
  ): Promise<{ success: boolean; count: number }> {
    let count = 0

    for (const item of items) {
      const result = await db
        .delete(userAccounts)
        .where(
          and(
            eq(userAccounts.userId, item.userId),
            eq(userAccounts.accountId, item.accountId)
          )
        )

      count++

      // Log audit
      await logAudit(db, ctx, 'UserAccount', `${item.userId}-${item.accountId}`, 'DELETE', {
        userId: item.userId,
        accountId: item.accountId,
      })
    }

    return { success: true, count }
  },

  async restore(
    db: Database,
    ctx: ServiceContext,
    id: string
  ): Promise<User> {
    // Find deleted record
    const [record] = await db
      .select()
      .from(users)
      .where(and(
        eq(users.id, id),
        isNotNull(users.deletedAt)
      ))
      .limit(1)

    if (!record) {
      throw new NotFoundError('User not found or not deleted')
    }

    // Restore user
    const [restored] = await auditedUpdate(
      db,
      ctx,
      users,
      { deletedAt: null, deletedById: null },
      eq(users.id, id)
    )

    if (!restored) {
      throw new NotFoundError('Failed to restore user')
    }

    return {
      id: restored.id,
      email: restored.email,
      name: restored.name,
      status: restored.status,
      providerIds: restored.providerIds || [],
      isSuperAdmin: restored.isSuperAdmin,
      createdAt: restored.createdAt,
      updatedAt: restored.updatedAt,
      deletedAt: restored.deletedAt,
    }
  },
}
