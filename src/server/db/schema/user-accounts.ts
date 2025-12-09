// src/db/schema/user-accounts.ts
import { sqliteTable, text, primaryKey } from 'drizzle-orm/sqlite-core'
import { users } from './users'
import { accounts } from './accounts'

export const userAccounts = sqliteTable(
  'user_accounts',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    role: text('role', {
      enum: ['ADMIN', 'MANAGER', 'EDITOR', 'AUTHOR', 'VIEWER', 'BILLING', 'ANALYTICS'],
    }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.accountId] }),
  })
)

export type UserAccountRecord = typeof userAccounts.$inferSelect
export type NewUserAccount = typeof userAccounts.$inferInsert
