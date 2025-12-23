import type { Database } from '../db/client'

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]

/**
 * Execute a callback within a database transaction.
 * - Callback succeeds → automatic commit
 * - Callback throws → automatic rollback
 *
 * @example
 * const result = await withTransaction(db, async (tx) => {
 *   const [account] = await tx.insert(accounts).values({ name: 'Acme' }).returning()
 *   const [user] = await tx.insert(users).values({ email: 'admin@acme.com' }).returning()
 *   return { account, user }
 * })
 */
export async function withTransaction<T>(
  db: Database,
  callback: (tx: Transaction) => Promise<T>
): Promise<T> {
  return db.transaction(callback)
}

export type { Transaction }
