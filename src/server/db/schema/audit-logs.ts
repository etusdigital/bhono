// src/db/schema/audit-logs.ts
import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'
import { users } from './users'
import { accounts } from './accounts'

export const auditLogs = sqliteTable('audit_logs', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  transactionId: text('transaction_id').notNull(),
  accountId: text('account_id').references(() => accounts.id),
  userId: text('user_id').references(() => users.id),
  entity: text('entity').notNull(),
  entityId: text('entity_id').notNull(),
  action: text('action', {
    enum: ['INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'SIGNUP', 'TOKEN_REFRESH', 'LOGIN_FAILED']
  }).notNull(),
  changes: text('changes', { mode: 'json' }).$type<Record<string, unknown>>(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  timestamp: text('timestamp').default(sql`(datetime('now'))`).notNull(),
})

export type AuditLogRecord = typeof auditLogs.$inferSelect
export type NewAuditLog = typeof auditLogs.$inferInsert
