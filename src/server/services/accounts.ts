// src/services/accounts.ts
import { eq, and, isNull, isNotNull, sql } from 'drizzle-orm'
import type { Database } from '../db/client'
import { accounts, userAccounts } from '../db/schema'
import { auditedInsert, auditedUpdate, auditedDelete } from '../lib/audited-db'
import { createPaginationMeta, calculateOffset } from '../lib/pagination'
import { NotFoundError, ConflictError, ForbiddenError } from '../lib/errors'
import type { ServiceContext, PaginationQuery, PaginatedResponse, Account } from '../types'

interface CreateAccountInput {
  name: string
  description?: string
  domain?: string
}

interface UpdateAccountInput {
  name?: string
  description?: string
  domain?: string
}

export const accountsService = {
  async findAll(
    db: Database,
    ctx: ServiceContext,
    pagination: PaginationQuery
  ): Promise<PaginatedResponse<Account>> {
    const offset = calculateOffset(pagination.page, pagination.limit)
    const conditions = [isNull(accounts.deletedAt)]

    // Non-super-admin sees only their accounts
    if (!ctx.user.isSuperAdmin) {
      const accountIdsForUser = db
        .select({ accountId: userAccounts.accountId })
        .from(userAccounts)
        .where(eq(userAccounts.userId, ctx.user.id))

      conditions.push(sql`${accounts.id} IN ${accountIdsForUser}`)
    }

    // Add search filter
    if (pagination.query) {
      conditions.push(
        sql`(${accounts.name} LIKE ${'%' + pagination.query + '%'} OR ${accounts.domain} LIKE ${'%' + pagination.query + '%'})`
      )
    }

    // Get count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(accounts)
      .where(and(...conditions))

    const totalItems = countResult?.count ?? 0

    // Get data
    const data = await db
      .select()
      .from(accounts)
      .where(and(...conditions))
      .limit(pagination.limit)
      .offset(offset)
      .orderBy(sql`${accounts.createdAt} DESC`)

    return {
      data: data.map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        domain: a.domain,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
        deletedAt: a.deletedAt,
      })),
      meta: createPaginationMeta(totalItems, pagination.page, pagination.limit),
    }
  },

  async findById(db: Database, ctx: ServiceContext, id: string): Promise<Account> {
    const [accountRecord] = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.id, id), isNull(accounts.deletedAt)))
      .limit(1)

    if (!accountRecord) {
      throw new NotFoundError('Account')
    }

    // Check access for non-super-admin
    if (!ctx.user.isSuperAdmin) {
      const [membership] = await db
        .select()
        .from(userAccounts)
        .where(
          and(
            eq(userAccounts.userId, ctx.user.id),
            eq(userAccounts.accountId, id)
          )
        )
        .limit(1)

      if (!membership) {
        throw new NotFoundError('Account')
      }
    }

    return {
      id: accountRecord.id,
      name: accountRecord.name,
      description: accountRecord.description,
      domain: accountRecord.domain,
      createdAt: accountRecord.createdAt,
      updatedAt: accountRecord.updatedAt,
      deletedAt: accountRecord.deletedAt,
    }
  },

  async create(db: Database, ctx: ServiceContext, input: CreateAccountInput): Promise<Account> {
    // Only super-admin can create accounts
    if (!ctx.user.isSuperAdmin) {
      throw new ForbiddenError('Only super-admin can create accounts')
    }

    // Check domain uniqueness if provided
    if (input.domain) {
      const [existing] = await db
        .select()
        .from(accounts)
        .where(eq(accounts.domain, input.domain))
        .limit(1)

      if (existing) {
        throw new ConflictError('Account with this domain already exists')
      }
    }

    // Create account with audit
    const [accountRecord] = await auditedInsert(
      db,
      ctx,
      accounts,
      {
        name: input.name,
        description: input.description || null,
        domain: input.domain || null,
      }
    )

    return {
      id: accountRecord.id,
      name: accountRecord.name,
      description: accountRecord.description,
      domain: accountRecord.domain,
      createdAt: accountRecord.createdAt,
      updatedAt: accountRecord.updatedAt,
      deletedAt: accountRecord.deletedAt,
    }
  },

  async update(db: Database, ctx: ServiceContext, id: string, input: UpdateAccountInput): Promise<Account> {
    await this.findById(db, ctx, id)

    // Check domain uniqueness if changing
    if (input.domain) {
      const [existing] = await db
        .select()
        .from(accounts)
        .where(and(eq(accounts.domain, input.domain), sql`${accounts.id} != ${id}`))
        .limit(1)

      if (existing) {
        throw new ConflictError('Account with this domain already exists')
      }
    }

    // Update account with audit
    const [accountRecord] = await auditedUpdate(
      db,
      ctx,
      accounts,
      {
        ...input,
        updatedAt: new Date().toISOString(),
      },
      eq(accounts.id, id)
    )

    return {
      id: accountRecord.id,
      name: accountRecord.name,
      description: accountRecord.description,
      domain: accountRecord.domain,
      createdAt: accountRecord.createdAt,
      updatedAt: accountRecord.updatedAt,
      deletedAt: accountRecord.deletedAt,
    }
  },

  async delete(db: Database, ctx: ServiceContext, id: string): Promise<void> {
    // Only super-admin can delete accounts
    if (!ctx.user.isSuperAdmin) {
      throw new ForbiddenError('Only super-admin can delete accounts')
    }

    await this.findById(db, ctx, id)

    // Soft delete with audit
    await auditedDelete(db, ctx, accounts, eq(accounts.id, id))
  },

  async restore(db: Database, ctx: ServiceContext, id: string): Promise<Account> {
    // Only super-admin can restore accounts
    if (!ctx.user.isSuperAdmin) {
      throw new ForbiddenError('Only super-admin can restore accounts')
    }

    // Find deleted record
    const [record] = await db
      .select()
      .from(accounts)
      .where(and(
        eq(accounts.id, id),
        isNotNull(accounts.deletedAt)
      ))
      .limit(1)

    if (!record) {
      throw new NotFoundError('Account not found or not deleted')
    }

    // Restore account
    const restored = await auditedUpdate(
      db,
      ctx,
      accounts,
      { deletedAt: null, deletedById: null },
      eq(accounts.id, id)
    )

    if (!restored) {
      throw new NotFoundError('Failed to restore account')
    }

    return {
      id: restored.id,
      name: restored.name,
      description: restored.description,
      domain: restored.domain,
      createdAt: restored.createdAt,
      updatedAt: restored.updatedAt,
      deletedAt: restored.deletedAt,
    }
  },
}
