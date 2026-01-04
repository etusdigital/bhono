// src/server/lib/transaction.ts

/**
 * Execute a callback within a database unit of work.
 *
 * Cloudflare D1 does not expose full transaction callbacks in the Worker runtime.
 * This helper forwards the D1 database instance to the callback.
 * If you need transactional guarantees, use explicit SQL (BEGIN/COMMIT) or
 * D1 batch operations in the calling code.
 */
export async function withTransaction<T>(
  db: D1Database,
  callback: (tx: D1Database) => Promise<T>
): Promise<T> {
  return callback(db)
}

export type Transaction = D1Database
