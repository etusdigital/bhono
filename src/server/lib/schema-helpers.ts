// src/lib/schema-helpers.ts
import { text, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const softDeleteFields = {
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
  deletedAt: text('deleted_at'),
}

export const createInteractiveFields = (usersTableRef: () => AnySQLiteColumn) => ({
  ...softDeleteFields,
  createdById: text('created_by_id').references(usersTableRef),
  updatedById: text('updated_by_id').references(usersTableRef),
  deletedById: text('deleted_by_id').references(usersTableRef),
})
