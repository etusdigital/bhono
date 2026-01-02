// src/db/schema/invitations.ts
import { sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'
import { accounts } from './accounts'
import { users } from './users'

export const invitations = sqliteTable('invitations', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  accountId: text('account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  role: text('role', {
    enum: ['ADMIN', 'MANAGER', 'EDITOR', 'AUTHOR', 'VIEWER', 'BILLING', 'ANALYTICS'],
  }).notNull(),
  token: text('token').notNull().unique(),
  invitedById: text('invited_by_id')
    .notNull()
    .references(() => users.id),
  expiresAt: text('expires_at').notNull(),
  acceptedAt: text('accepted_at'),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
}, (table) => [
  uniqueIndex('account_email_idx').on(table.accountId, table.email),
])

export type InvitationRecord = typeof invitations.$inferSelect
export type NewInvitation = typeof invitations.$inferInsert
