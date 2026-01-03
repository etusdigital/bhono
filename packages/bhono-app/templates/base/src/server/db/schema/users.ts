// src/db/schema/users.ts
import { sqliteTable, text, integer, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const users = sqliteTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  googleId: text('google_id').notNull().unique(),
  email: text('email').notNull(),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
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
  createdById: text('created_by_id').references((): AnySQLiteColumn => users.id),
  updatedById: text('updated_by_id').references((): AnySQLiteColumn => users.id),
  deletedById: text('deleted_by_id').references((): AnySQLiteColumn => users.id),
})

export type UserRecord = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
