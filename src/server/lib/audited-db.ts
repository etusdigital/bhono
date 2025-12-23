// src/server/lib/audited-db.ts
import { type SQL } from 'drizzle-orm'
import type { SQLiteTable } from 'drizzle-orm/sqlite-core'
import type { Database } from '../db/client'
import type { ServiceContext } from '../types'
import { logAudit, createChangeDiff } from './audit'

type TableWithId = SQLiteTable & { id: any }

/**
 * Get the table name from a Drizzle table definition
 */
function getTableName(table: SQLiteTable): string {
  return (table as any)[Symbol.for('drizzle:Name')] || 'unknown'
}

/**
 * Insert with automatic audit logging
 * Returns the inserted records (same as .returning())
 */
export async function auditedInsert<T extends Record<string, unknown>>(
  db: Database,
  ctx: ServiceContext,
  table: TableWithId,
  values: T | T[]
): Promise<T[]> {
  const tableName = getTableName(table)
  const valuesArray = Array.isArray(values) ? values : [values]

  const results = await db
    .insert(table)
    .values(valuesArray as any)
    .returning()

  // Log audit for each inserted record
  for (const record of results) {
    await logAudit(
      db,
      ctx,
      tableName,
      (record as any).id,
      'INSERT',
      record as Record<string, unknown>
    )
  }

  return results as T[]
}

/**
 * Update with automatic audit logging (includes diff of changes)
 * Returns the updated records (same as .returning())
 */
export async function auditedUpdate<T extends Record<string, unknown>>(
  db: Database,
  ctx: ServiceContext,
  table: TableWithId,
  values: Partial<T>,
  where: SQL
): Promise<T[]> {
  const tableName = getTableName(table)

  // Get old data first for diff
  const oldRecords = await db
    .select()
    .from(table)
    .where(where)
    .limit(100) // Safety limit

  // Perform update
  const results = await db
    .update(table)
    .set(values as any)
    .where(where)
    .returning()

  // Log audit for each updated record with diff
  for (let i = 0; i < results.length; i++) {
    const oldData = oldRecords[i] || {}
    const newData = results[i]
    const diff = createChangeDiff(
      oldData as Record<string, unknown>,
      newData as Record<string, unknown>
    )

    await logAudit(
      db,
      ctx,
      tableName,
      (newData as any).id,
      'UPDATE',
      diff
    )
  }

  return results as T[]
}

/**
 * Soft delete with automatic audit logging
 * Sets deletedAt and deletedById fields
 */
export async function auditedDelete(
  db: Database,
  ctx: ServiceContext,
  table: TableWithId,
  where: SQL
): Promise<void> {
  const tableName = getTableName(table)

  // Perform soft delete
  const results = await db
    .update(table)
    .set({
      deletedAt: new Date().toISOString(),
      deletedById: ctx.user.id,
      updatedAt: new Date().toISOString(),
      updatedById: ctx.user.id,
    } as any)
    .where(where)
    .returning()

  // Log audit for each deleted record
  for (const record of results) {
    await logAudit(
      db,
      ctx,
      tableName,
      (record as any).id,
      'DELETE',
      { deleted: true }
    )
  }
}
