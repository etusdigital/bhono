/**
 * Schema Helpers Integration Tests
 *
 * Tests the Drizzle ORM schema helper functions:
 * - softDeleteFields export
 * - createInteractiveFields factory function
 */

import { describe, it, expect } from 'vitest'
import { softDeleteFields, createInteractiveFields } from '../../lib/schema-helpers'
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core'

describe('Schema Helpers', () => {
  // ============================================================================
  // softDeleteFields Tests
  // ============================================================================

  describe('softDeleteFields', () => {
    it('should export createdAt field', () => {
      expect(softDeleteFields).toHaveProperty('createdAt')
      expect(softDeleteFields.createdAt).toBeDefined()
    })

    it('should export updatedAt field', () => {
      expect(softDeleteFields).toHaveProperty('updatedAt')
      expect(softDeleteFields.updatedAt).toBeDefined()
    })

    it('should export deletedAt field', () => {
      expect(softDeleteFields).toHaveProperty('deletedAt')
      expect(softDeleteFields.deletedAt).toBeDefined()
    })

    it('should have exactly 3 fields', () => {
      const fieldCount = Object.keys(softDeleteFields).length
      expect(fieldCount).toBe(3)
    })

    it('createdAt should have notNull constraint', () => {
      // Drizzle column config stores notNull in the column config
      expect(softDeleteFields.createdAt.config?.notNull).toBe(true)
    })

    it('updatedAt should have notNull constraint', () => {
      expect(softDeleteFields.updatedAt.config?.notNull).toBe(true)
    })

    it('deletedAt should be nullable (soft delete marker)', () => {
      // deletedAt should NOT have notNull, allowing null values
      expect(softDeleteFields.deletedAt.config?.notNull).toBeFalsy()
    })

    it('createdAt should have default value', () => {
      expect(softDeleteFields.createdAt.config?.default).toBeDefined()
    })

    it('updatedAt should have default value', () => {
      expect(softDeleteFields.updatedAt.config?.default).toBeDefined()
    })
  })

  // ============================================================================
  // createInteractiveFields Tests
  // ============================================================================

  describe('createInteractiveFields', () => {
    // Mock users table reference for testing
    const mockUsersTableRef = (() => ({ name: 'id' })) as () => AnySQLiteColumn

    it('should return an object with all required fields', () => {
      const fields = createInteractiveFields(mockUsersTableRef)

      expect(fields).toHaveProperty('createdAt')
      expect(fields).toHaveProperty('updatedAt')
      expect(fields).toHaveProperty('deletedAt')
      expect(fields).toHaveProperty('createdById')
      expect(fields).toHaveProperty('updatedById')
      expect(fields).toHaveProperty('deletedById')
    })

    it('should have exactly 6 fields', () => {
      const fields = createInteractiveFields(mockUsersTableRef)
      const fieldCount = Object.keys(fields).length
      expect(fieldCount).toBe(6)
    })

    it('should include softDeleteFields', () => {
      const fields = createInteractiveFields(mockUsersTableRef)

      // Should have the same timestamp fields from softDeleteFields
      expect(fields.createdAt).toBeDefined()
      expect(fields.updatedAt).toBeDefined()
      expect(fields.deletedAt).toBeDefined()
    })

    it('should create createdById field', () => {
      const fields = createInteractiveFields(mockUsersTableRef)
      expect(fields.createdById).toBeDefined()
    })

    it('should create updatedById field', () => {
      const fields = createInteractiveFields(mockUsersTableRef)
      expect(fields.updatedById).toBeDefined()
    })

    it('should create deletedById field', () => {
      const fields = createInteractiveFields(mockUsersTableRef)
      expect(fields.deletedById).toBeDefined()
    })

    it('should work with different table references', () => {
      const anotherRef = (() => ({ name: 'user_id' })) as () => AnySQLiteColumn
      const fields = createInteractiveFields(anotherRef)

      expect(fields).toHaveProperty('createdById')
      expect(fields).toHaveProperty('updatedById')
      expect(fields).toHaveProperty('deletedById')
    })

    it('userId fields should be nullable (optional tracking)', () => {
      const fields = createInteractiveFields(mockUsersTableRef)

      // User ID fields should be nullable (not all operations have a user context)
      expect(fields.createdById.config?.notNull).toBeFalsy()
      expect(fields.updatedById.config?.notNull).toBeFalsy()
      expect(fields.deletedById.config?.notNull).toBeFalsy()
    })
  })
})
