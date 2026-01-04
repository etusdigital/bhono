// src/server/lib/audited-db.ts
import type { ServiceContext } from '../types'
import { logAudit, createChangeDiff } from './audit'
import { execute, queryAll, toStringValue, type SqlParams } from '../db/sql'

/**
 * Base interface for auditable records - requires an id field
 */
interface AuditableRecord {
  id: string
}

export interface SqlWhereClause {
  clause: string
  params?: SqlParams
}

export interface SqlAuditOptions {
  primaryKey?: string
  columnMap?: Record<string, string>
  now?: () => string
}

export interface SqlDeleteOptions extends SqlAuditOptions {
  softDeleteColumns?: {
    deletedAt?: string
    deletedById?: string
    updatedAt?: string
    updatedById?: string
  }
}

const DEFAULT_SOFT_DELETE_COLUMNS = {
  deletedAt: 'deleted_at',
  deletedById: 'deleted_by_id',
  updatedAt: 'updated_at',
  updatedById: 'updated_by_id',
}

function mapValues(values: Record<string, unknown>, columnMap?: Record<string, string>): Record<string, unknown> {
  if (!columnMap) {
    return values
  }

  const mapped: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(values)) {
    const column = columnMap[key] ?? key
    mapped[column] = value
  }
  return mapped
}

function normalizeRows(
  values: Record<string, unknown> | Record<string, unknown>[],
  columnMap?: Record<string, string>
): { columns: string[]; rows: Record<string, unknown>[] } {
  const valuesArray = Array.isArray(values) ? values : [values]
  const mapped = valuesArray.map((value) => mapValues(value, columnMap))

  const columnSet = new Set<string>()
  for (const row of mapped) {
    for (const key of Object.keys(row)) {
      columnSet.add(key)
    }
  }

  const columns = [...columnSet]
  if (columns.length === 0) {
    throw new Error('No columns provided for SQL operation')
  }

  const rows = mapped.map((row) => {
    const normalized: Record<string, unknown> = {}
    for (const column of columns) {
      normalized[column] = row[column] ?? null
    }
    return normalized
  })

  return { columns, rows }
}

function buildInsertSql(tableName: string, columns: string[], rowCount: number): string {
  const columnList = columns.join(', ')
  const rowPlaceholders = `(${columns.map(() => '?').join(', ')})`
  const valuesPlaceholders = Array.from({ length: rowCount }, () => rowPlaceholders).join(', ')
  return `INSERT INTO ${tableName} (${columnList}) VALUES ${valuesPlaceholders} RETURNING *`
}

async function auditedInsertSql<TRecord extends AuditableRecord>(
  db: D1Database,
  ctx: ServiceContext,
  tableName: string,
  values: Record<string, unknown> | Record<string, unknown>[],
  options?: SqlAuditOptions
): Promise<TRecord[]> {
  const { columns, rows } = normalizeRows(values, options?.columnMap)
  const sql = buildInsertSql(tableName, columns, rows.length)
  const params = rows.flatMap((row) => columns.map((column) => row[column])) as SqlParams
  const results = await queryAll<Record<string, unknown>>(db, sql, params)

  for (const record of results) {
    const entityId = toStringValue(record[options?.primaryKey ?? 'id'])
    await logAudit(db, ctx, tableName, entityId, 'INSERT', record)
  }

  return results as TRecord[]
}

async function auditedUpdateSql<TRecord extends AuditableRecord>(
  db: D1Database,
  ctx: ServiceContext,
  tableName: string,
  values: Record<string, unknown>,
  where: SqlWhereClause,
  options?: SqlAuditOptions
): Promise<TRecord[]> {
  const mappedValues = mapValues(values, options?.columnMap)
  const columns = Object.keys(mappedValues)
  if (columns.length === 0) {
    throw new Error('No columns provided for SQL update')
  }

  const whereClause = where.clause.trim()
  if (!whereClause) {
    throw new Error('Missing SQL where clause for auditedUpdate')
  }

  const oldRecords = await queryAll<Record<string, unknown>>(
    db,
    `SELECT * FROM ${tableName} WHERE ${whereClause} LIMIT 100`,
    where.params
  )

  const setClause = columns.map((column) => `${column} = ?`).join(', ')
  const params = [...columns.map((column) => mappedValues[column]), ...(where.params ?? [])] as SqlParams

  let results: Record<string, unknown>[] = []
  try {
    results = await queryAll<Record<string, unknown>>(
      db,
      `UPDATE ${tableName} SET ${setClause} WHERE ${whereClause} RETURNING *`,
      params
    )
  } catch {
    await execute(db, `UPDATE ${tableName} SET ${setClause} WHERE ${whereClause}`, params)
    results = await queryAll<Record<string, unknown>>(
      db,
      `SELECT * FROM ${tableName} WHERE ${whereClause} LIMIT 100`,
      where.params
    )
  }

  const primaryKey = options?.primaryKey ?? 'id'
  const oldById = new Map<string, Record<string, unknown>>()
  for (const record of oldRecords) {
    const id = toStringValue(record[primaryKey])
    oldById.set(id, record)
  }

  for (const record of results) {
    const entityId = toStringValue(record[primaryKey])
    const oldData = oldById.get(entityId) ?? {}
    const diff = createChangeDiff(oldData, record)
    await logAudit(db, ctx, tableName, entityId, 'UPDATE', diff)
  }

  return results as TRecord[]
}

async function auditedDeleteSql(
  db: D1Database,
  ctx: ServiceContext,
  tableName: string,
  where: SqlWhereClause,
  options?: SqlDeleteOptions
): Promise<void> {
  const whereClause = where.clause.trim()
  if (!whereClause) {
    throw new Error('Missing SQL where clause for auditedDelete')
  }

  const now = options?.now ?? (() => new Date().toISOString())
  const timestamp = now()
  const columns = {
    ...DEFAULT_SOFT_DELETE_COLUMNS,
    ...options?.softDeleteColumns,
  }

  const setColumns: [string, unknown][] = [
    [columns.deletedAt, timestamp],
    [columns.deletedById, ctx.user.id],
    [columns.updatedAt, timestamp],
    [columns.updatedById, ctx.user.id],
  ]

  const setClause = setColumns.map(([column]) => `${column} = ?`).join(', ')
  const params = [...setColumns.map(([, value]) => value), ...(where.params ?? [])] as SqlParams

  let results: Record<string, unknown>[] = []
  try {
    results = await queryAll<Record<string, unknown>>(
      db,
      `UPDATE ${tableName} SET ${setClause} WHERE ${whereClause} RETURNING *`,
      params
    )
  } catch {
    await execute(db, `UPDATE ${tableName} SET ${setClause} WHERE ${whereClause}`, params)
    results = await queryAll<Record<string, unknown>>(
      db,
      `SELECT * FROM ${tableName} WHERE ${whereClause} LIMIT 100`,
      where.params
    )
  }

  const primaryKey = options?.primaryKey ?? 'id'
  for (const record of results) {
    const entityId = toStringValue(record[primaryKey])
    await logAudit(db, ctx, tableName, entityId, 'DELETE', { deleted: true })
  }
}

/**
 * Insert with automatic audit logging
 * Returns the inserted records (same as .returning())
 */
export async function auditedInsert<TRecord extends AuditableRecord>(
  db: D1Database,
  ctx: ServiceContext,
  table: string,
  values: Record<string, unknown> | Record<string, unknown>[],
  options?: SqlAuditOptions
): Promise<TRecord[]> {
  return auditedInsertSql(db, ctx, table, values, options)
}

/**
 * Update with automatic audit logging (includes diff of changes)
 * Returns the updated records (same as .returning())
 */
export async function auditedUpdate<TRecord extends AuditableRecord>(
  db: D1Database,
  ctx: ServiceContext,
  table: string,
  values: Record<string, unknown>,
  where: SqlWhereClause,
  options?: SqlAuditOptions
): Promise<TRecord[]> {
  return auditedUpdateSql(db, ctx, table, values, where, options)
}

/**
 * Soft delete with automatic audit logging
 * Sets deletedAt and deletedById fields
 */
export async function auditedDelete(
  db: D1Database,
  ctx: ServiceContext,
  table: string,
  where: SqlWhereClause,
  options?: SqlDeleteOptions
): Promise<void> {
  await auditedDeleteSql(db, ctx, table, where, options)
}
