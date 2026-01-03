// src/server/lib/audited-db.ts
import { type SQL, getTableName as drizzleGetTableName, is, Table } from 'drizzle-orm'
import type { SQLiteTable } from 'drizzle-orm/sqlite-core'
import type { Database } from '../db/client'
import type { ServiceContext } from '../types'
import { logAudit, createChangeDiff } from './audit'

/**
 * Base interface for auditable records - requires an id field
 */
interface AuditableRecord {
  id: string
}

/**
 * Get the table name from a Drizzle table definition
 */
function getTableName(table: SQLiteTable): string {
  if (is(table, Table)) {
    return drizzleGetTableName(table)
  }
  return 'unknown'
}

/**
 * Insert with automatic audit logging
 * Returns the inserted records (same as .returning())
 */
export async function auditedInsert<TRecord extends AuditableRecord>(
  db: Database,
  ctx: ServiceContext,
  table: SQLiteTable,
  values: Record<string, unknown> | Record<string, unknown>[]
): Promise<TRecord[]> {
  const tableName = getTableName(table)
  const valuesArray = Array.isArray(values) ? values : [values]

  const results = await db
    .insert(table)
    .values(valuesArray)
    .returning()

  // Log audit for each inserted record
  for (const record of results) {
    const typedRecord = record as unknown as TRecord
    await logAudit(
      db,
      ctx,
      tableName,
      typedRecord.id,
      'INSERT',
      record as Record<string, unknown>
    )
  }

  return results as unknown as TRecord[]
}

/**
 * Update with automatic audit logging (includes diff of changes)
 * Returns the updated records (same as .returning())
 */
export async function auditedUpdate<TRecord extends AuditableRecord>(
  db: Database,
  ctx: ServiceContext,
  table: SQLiteTable,
  values: Record<string, unknown>,
  where: SQL
): Promise<TRecord[]> {
  const tableName = getTableName(table)

  // Get old data first for diff
  const oldRecords = await db
    .select()
    .from(table)
    .where(where)
    .limit(100) // Safety limit

  const results = await db
    .update(table)
    .set(values)
    .where(where)
    .returning()

  // Log audit for each updated record with diff
  for (let i = 0; i < results.length; i++) {
    const oldData = (oldRecords[i] ?? {}) as Record<string, unknown>
    const newData = results[i] as unknown as TRecord
    const diff = createChangeDiff(
      oldData,
      newData as Record<string, unknown>
    )

    await logAudit(
      db,
      ctx,
      tableName,
      newData.id,
      'UPDATE',
      diff
    )
  }

  return results as unknown as TRecord[]
}

/**
 * Interface for soft-deletable tables with required audit fields
 */
interface SoftDeletableFields {
  deletedAt: string | null
  deletedById: string | null
  updatedAt: string
  updatedById: string | null
}

/**
 * Soft delete with automatic audit logging
 * Sets deletedAt and deletedById fields
 */
export async function auditedDelete(
  db: Database,
  ctx: ServiceContext,
  table: SQLiteTable,
  where: SQL
): Promise<void> {
  const tableName = getTableName(table)

  const softDeleteValues: SoftDeletableFields = {
    deletedAt: new Date().toISOString(),
    deletedById: ctx.user.id,
    updatedAt: new Date().toISOString(),
    updatedById: ctx.user.id,
  }

  const results = await db
    .update(table)
    .set(softDeleteValues)
    .where(where)
    .returning()

  // Log audit for each deleted record
  for (const record of results) {
    const typedRecord = record as unknown as AuditableRecord
    await logAudit(
      db,
      ctx,
      tableName,
      typedRecord.id,
      'DELETE',
      { deleted: true }
    )
  }
}
