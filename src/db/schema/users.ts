// src/db/schema/users.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const users = sqliteTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  status: text('status', { enum: ['active', 'inactive'] })
    .default('active')
    .notNull(),
  providerIds: text('provider_ids', { mode: 'json' })
    .$type<string[]>()
    .default([]),
  isSuperAdmin: integer('is_super_admin', { mode: 'boolean' })
    .default(false)
    .notNull(),

  // Soft delete + audit fields
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
  deletedAt: text('deleted_at'),
  createdById: text('created_by_id').references((): any => users.id),
  updatedById: text('updated_by_id').references((): any => users.id),
  deletedById: text('deleted_by_id').references((): any => users.id),
})

export type UserRecord = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
