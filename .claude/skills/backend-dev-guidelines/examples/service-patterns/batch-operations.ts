/**
 * Batch Operations Pattern
 *
 * Example of transactional batch operations using executeBatch.
 * All statements succeed or all fail (atomic).
 */

import {
  executeBatch,
  queryOne,
  type BatchStatement,
} from '@server/db/sql'
import { NotFoundError, ConflictError } from '@server/lib/errors'
import type { ServiceContext } from '@server/types'

export const userAccountService = {
  /**
   * Create user with account membership in single transaction
   * Uses batch for atomicity
   */
  async createUserWithAccount(
    db: D1Database,
    ctx: ServiceContext,
    input: {
      email: string
      name: string
      accountId: string
      role: string
    }
  ) {
    // Check for existing user
    const existing = await queryOne(
      db,
      'SELECT 1 FROM users WHERE email = ? LIMIT 1',
      [input.email]
    )
    if (existing) {
      throw new ConflictError('Email already in use')
    }

    const userId = crypto.randomUUID()
    const now = new Date().toISOString()

    // Batch insert - all succeed or all fail
    const statements: BatchStatement[] = [
      {
        statement: `
          INSERT INTO users (id, email, name, status, created_at, updated_at)
          VALUES (?, ?, ?, 'active', ?, ?)
        `,
        params: [userId, input.email, input.name, now, now],
      },
      {
        statement: `
          INSERT INTO user_accounts (user_id, account_id, role, created_at)
          VALUES (?, ?, ?, ?)
        `,
        params: [userId, input.accountId, input.role, now],
      },
      {
        statement: `
          INSERT INTO audit_logs (entity, entity_id, action, user_id, account_id, timestamp)
          VALUES ('users', ?, 'INSERT', ?, ?, ?)
        `,
        params: [userId, ctx.user.id, ctx.accountId, now],
      },
    ]

    await executeBatch(db, statements)

    return { userId }
  },

  /**
   * Bulk update status for multiple items
   */
  async bulkUpdateStatus(
    db: D1Database,
    ctx: ServiceContext,
    ids: string[],
    status: string
  ) {
    const now = new Date().toISOString()

    const statements: BatchStatement[] = ids.map((id) => ({
      statement: `
        UPDATE products
        SET status = ?, updated_at = ?, updated_by_id = ?
        WHERE id = ? AND account_id = ?
      `,
      params: [status, now, ctx.user.id, id, ctx.accountId],
    }))

    // Add audit log for each update
    ids.forEach((id) => {
      statements.push({
        statement: `
          INSERT INTO audit_logs (entity, entity_id, action, user_id, account_id, changes, timestamp)
          VALUES ('products', ?, 'UPDATE', ?, ?, ?, ?)
        `,
        params: [id, ctx.user.id, ctx.accountId, JSON.stringify({ status }), now],
      })
    })

    await executeBatch(db, statements)

    return { updated: ids.length }
  },

  /**
   * Transfer ownership with related data
   */
  async transferOwnership(
    db: D1Database,
    ctx: ServiceContext,
    entityId: string,
    newOwnerId: string
  ) {
    // Verify entity exists
    const entity = await queryOne(
      db,
      'SELECT id, owner_id FROM entities WHERE id = ? LIMIT 1',
      [entityId]
    )
    if (!entity) {
      throw new NotFoundError('Entity')
    }

    const now = new Date().toISOString()
    const oldOwnerId = entity.owner_id

    // Transfer entity and all related data atomically
    const statements: BatchStatement[] = [
      // Update main entity
      {
        statement: `
          UPDATE entities
          SET owner_id = ?, updated_at = ?, updated_by_id = ?
          WHERE id = ?
        `,
        params: [newOwnerId, now, ctx.user.id, entityId],
      },
      // Update related items
      {
        statement: `
          UPDATE entity_items
          SET owner_id = ?, updated_at = ?
          WHERE entity_id = ?
        `,
        params: [newOwnerId, now, entityId],
      },
      // Audit log
      {
        statement: `
          INSERT INTO audit_logs (entity, entity_id, action, user_id, account_id, changes, timestamp)
          VALUES ('entities', ?, 'TRANSFER', ?, ?, ?, ?)
        `,
        params: [
          entityId,
          ctx.user.id,
          ctx.accountId,
          JSON.stringify({ from: oldOwnerId, to: newOwnerId }),
          now,
        ],
      },
    ]

    await executeBatch(db, statements)

    return { transferred: true }
  },
}
