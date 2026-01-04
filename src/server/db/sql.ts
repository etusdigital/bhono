// src/server/db/sql.ts

export type SqlValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | bigint
  | Uint8Array
  | ArrayBuffer
  | Date

export type SqlParams = SqlValue[]

export type SqlRow = Record<string, unknown>
export type RowMapper<T> = (row: SqlRow) => T

function normalizeValue(value: SqlValue): unknown {
  if (value === undefined) return null
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'boolean') return value ? 1 : 0
  return value
}

function normalizeParams(params?: SqlParams): unknown[] {
  return (params ?? []).map((value) => normalizeValue(value))
}

function prepareStatement(db: D1Database, statement: string, params?: SqlParams): D1PreparedStatement {
  const prepared = db.prepare(statement)
  const normalized = normalizeParams(params)
  return normalized.length > 0 ? prepared.bind(...normalized) : prepared
}

export async function queryAll<T = SqlRow>(
  db: D1Database,
  statement: string,
  params?: SqlParams,
  mapper?: RowMapper<T>
): Promise<T[]> {
  const prepared = prepareStatement(db, statement, params)
  const result = await prepared.all<SqlRow>()
  const rows = result.results ?? []
  return mapper ? rows.map(mapper) : (rows as T[])
}

export async function queryOne<T = SqlRow>(
  db: D1Database,
  statement: string,
  params?: SqlParams,
  mapper?: RowMapper<T>
): Promise<T | null> {
  const prepared = prepareStatement(db, statement, params)
  const row = await prepared.first<SqlRow>()
  if (!row) return null
  return mapper ? mapper(row) : (row as T)
}

export async function queryValue<T = unknown>(
  db: D1Database,
  statement: string,
  params?: SqlParams,
  column?: string
): Promise<T | null> {
  const row = await queryOne<SqlRow>(db, statement, params)
  if (!row) return null
  if (column) return (row[column] as T) ?? null
  const firstKey = Object.keys(row)[0]
  if (!firstKey) return null
  return row[firstKey] as T
}

export async function execute(
  db: D1Database,
  statement: string,
  params?: SqlParams
): Promise<D1Result<unknown>> {
  const prepared = prepareStatement(db, statement, params)
  return prepared.run()
}

export interface BatchStatement {
  statement: string
  params?: SqlParams
}

export async function executeBatch(
  db: D1Database,
  statements: BatchStatement[]
): Promise<D1Result<unknown>[]> {
  const preparedStatements = statements.map((item) =>
    prepareStatement(db, item.statement, item.params)
  )
  return db.batch(preparedStatements)
}
