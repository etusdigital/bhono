// src/server/routes/storage/__tests__/handlers.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { HonoEnv } from '@server/types'
import { storage } from '@server/routes/index'
import { createMockEnv } from '@tests/helpers/server'
import { createUserFixture, createAccountFixture } from '@tests/fixtures/server'

// Mock the r2-storage lib
vi.mock('@server/lib/r2-storage', () => ({
  generateUploadUrl: vi.fn(),
  uploadFile: vi.fn(),
  deleteFile: vi.fn(),
  getFileMetadata: vi.fn(),
}))

import {
  generateUploadUrl,
  uploadFile,
  deleteFile,
  getFileMetadata,
} from '@server/lib/r2-storage'

// Test UUIDs
const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440001'
const TEST_ACCOUNT_ID = '550e8400-e29b-41d4-a716-446655440101'

describe('Storage Routes', () => {
  let mockEnv: ReturnType<typeof createMockEnv>
  let mockDb: any
  let testUser: ReturnType<typeof createUserFixture>
  let testAccount: ReturnType<typeof createAccountFixture>

  beforeEach(() => {
    vi.clearAllMocks()
    mockEnv = createMockEnv()

    testUser = createUserFixture({ id: TEST_USER_ID, email: 'test@example.com' })
    testAccount = createAccountFixture({ id: TEST_ACCOUNT_ID })

    // Create mock database
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([]),
      execute: vi.fn().mockResolvedValue({ rows: [] }),
    }
  })

  // Helper to setup authenticated app with specific role
  function setupAuthenticatedApp(userRole = 'user', isSuperAdmin = false) {
    const app = new Hono<HonoEnv>()

    app.use('*', async (c, next) => {
      ;(c as any).env = mockEnv
      c.set('db', mockDb)
      c.set('transactionId', 'test-transaction-id')
      c.set('ip', '127.0.0.1')
      c.set('userAgent', 'TestAgent/1.0')
      c.set('user', { ...testUser, isSuperAdmin })
      c.set('accountId', testAccount.id)
      c.set('userRole', userRole)
      c.set('isSystemAdminAccess', isSuperAdmin)
      await next()
    })

    app.route('/storage', storage)
    return app
  }

  // Helper to setup app without R2 configured
  function setupAppWithoutR2(userRole = 'user') {
    const app = new Hono<HonoEnv>()
    const envWithoutR2 = { ...mockEnv, R2_BUCKET: undefined }

    app.use('*', async (c, next) => {
      ;(c as any).env = envWithoutR2
      c.set('db', mockDb)
      c.set('transactionId', 'test-transaction-id')
      c.set('ip', '127.0.0.1')
      c.set('userAgent', 'TestAgent/1.0')
      c.set('user', testUser)
      c.set('accountId', testAccount.id)
      c.set('userRole', userRole)
      c.set('isSystemAdminAccess', false)
      await next()
    })

    app.route('/storage', storage)
    return app
  }

  // Helper to setup app without R2_PUBLIC_URL configured
  function setupAppWithoutPublicUrl(userRole = 'user') {
    const app = new Hono<HonoEnv>()
    const envWithoutPublicUrl = { ...mockEnv, R2_PUBLIC_URL: undefined }

    app.use('*', async (c, next) => {
      ;(c as any).env = envWithoutPublicUrl
      c.set('db', mockDb)
      c.set('transactionId', 'test-transaction-id')
      c.set('ip', '127.0.0.1')
      c.set('userAgent', 'TestAgent/1.0')
      c.set('user', testUser)
      c.set('accountId', testAccount.id)
      c.set('userRole', userRole)
      c.set('isSystemAdminAccess', false)
      await next()
    })

    app.route('/storage', storage)
    return app
  }

  // Helper to setup app without accountId in context
  function setupAppWithoutAccountId(userRole = 'user') {
    const app = new Hono<HonoEnv>()

    app.use('*', async (c, next) => {
      ;(c as any).env = mockEnv
      c.set('db', mockDb)
      c.set('transactionId', 'test-transaction-id')
      c.set('ip', '127.0.0.1')
      c.set('userAgent', 'TestAgent/1.0')
      c.set('user', testUser)
      // Note: accountId is NOT set
      c.set('userRole', userRole)
      c.set('isSystemAdminAccess', false)
      await next()
    })

    app.route('/storage', storage)
    return app
  }

  // Helper to setup app with trailing slash in R2_PUBLIC_URL
  function setupAppWithTrailingSlashUrl(userRole = 'user') {
    const app = new Hono<HonoEnv>()
    const envWithTrailingSlash = { ...mockEnv, R2_PUBLIC_URL: 'https://r2-test.example.com/' }

    app.use('*', async (c, next) => {
      ;(c as any).env = envWithTrailingSlash
      c.set('db', mockDb)
      c.set('transactionId', 'test-transaction-id')
      c.set('ip', '127.0.0.1')
      c.set('userAgent', 'TestAgent/1.0')
      c.set('user', testUser)
      c.set('accountId', testAccount.id)
      c.set('userRole', userRole)
      c.set('isSystemAdminAccess', false)
      await next()
    })

    app.route('/storage', storage)
    return app
  }

  describe('POST /storage/upload-url (generateUploadUrlHandler)', () => {
    it('should return upload URL with account prefix', async () => {
      const mockResult = {
        url: `/api/storage/upload/${encodeURIComponent(`${TEST_ACCOUNT_ID}/images/1703123456789-test.jpg`)}`,
        name: `${TEST_ACCOUNT_ID}/images/1703123456789-test.jpg`,
        publicUrl: `https://r2-test.example.com/${TEST_ACCOUNT_ID}/images/1703123456789-test.jpg`,
      }

      vi.mocked(generateUploadUrl).mockReturnValue(mockResult)

      const app = setupAuthenticatedApp('user')

      const res = await app.request('/storage/upload-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: 'images/test.jpg',
          contentType: 'image/jpeg',
        }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.url).toBe(mockResult.url)
      expect(body.name).toBe(mockResult.name)
      expect(body.publicUrl).toBe(mockResult.publicUrl)
      // ADR-001 Invariante 8: Verify accountId is passed to generateUploadUrl
      expect(generateUploadUrl).toHaveBeenCalledWith(
        mockEnv.R2_BUCKET,
        mockEnv.R2_PUBLIC_URL,
        'images/test.jpg',
        'image/jpeg',
        TEST_ACCOUNT_ID
      )
    })

    it('should throw ValidationError when R2 not configured', async () => {
      const app = setupAppWithoutR2('user')

      const res = await app.request('/storage/upload-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        }),
      })

      expect(res.status).toBe(400)
      const body = await res.text()
      expect(body).toContain('R2 storage is not configured')
    })

    it('should throw ValidationError when R2_PUBLIC_URL not configured', async () => {
      const app = setupAppWithoutPublicUrl('user')

      const res = await app.request('/storage/upload-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        }),
      })

      expect(res.status).toBe(400)
      const body = await res.text()
      expect(body).toContain('R2 public URL is not configured')
    })

    it('should throw ValidationError when accountId not in context', async () => {
      const app = setupAppWithoutAccountId('user')

      const res = await app.request('/storage/upload-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        }),
      })

      expect(res.status).toBe(400)
      const body = await res.text()
      expect(body).toContain('Account context is required for storage operations')
    })

    it('should require AUTHOR role or higher', async () => {
      const app = setupAuthenticatedApp('viewer')

      const res = await app.request('/storage/upload-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        }),
      })

      expect(res.status).toBe(403)
    })

    it('should allow EDITOR role', async () => {
      const mockResult = {
        url: `/api/storage/upload/${encodeURIComponent(`${TEST_ACCOUNT_ID}/test.jpg`)}`,
        name: `${TEST_ACCOUNT_ID}/test.jpg`,
        publicUrl: `https://r2-test.example.com/${TEST_ACCOUNT_ID}/test.jpg`,
      }

      vi.mocked(generateUploadUrl).mockReturnValue(mockResult)

      const app = setupAuthenticatedApp('user')

      const res = await app.request('/storage/upload-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        }),
      })

      expect(res.status).toBe(200)
    })
  })

  describe('PUT /storage/upload/{key} (uploadFileHandler)', () => {
    it('should upload file successfully with account-scoped key', async () => {
      const accountScopedKey = `${TEST_ACCOUNT_ID}/images/test.jpg`
      const mockR2Object = {
        key: accountScopedKey,
        size: 100,
        httpEtag: '"abc123"',
        uploaded: new Date(),
      }

      vi.mocked(uploadFile).mockResolvedValue(mockR2Object as any)

      const app = setupAuthenticatedApp('user')

      const fileContent = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) // PNG magic bytes
      const res = await app.request(`/storage/upload/${encodeURIComponent(accountScopedKey)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'image/png',
        },
        body: fileContent,
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.key).toBe(accountScopedKey)
      expect(body.publicUrl).toContain(accountScopedKey)
      expect(uploadFile).toHaveBeenCalledWith(
        mockEnv.R2_BUCKET,
        accountScopedKey,
        expect.any(ArrayBuffer),
        'image/png'
      )
    })

    it('should reject upload to key not scoped to current account (ADR-001 Invariante 8)', async () => {
      const app = setupAuthenticatedApp('user')

      const fileContent = new Uint8Array([0x89, 0x50, 0x4e, 0x47])
      // Try to upload to a different account's path
      const res = await app.request('/storage/upload/other-account-id%2Ftest.jpg', {
        method: 'PUT',
        headers: {
          'Content-Type': 'image/png',
        },
        body: fileContent,
      })

      expect(res.status).toBe(403)
      const body = await res.text()
      expect(body).toContain('Access denied')
    })

    it('should throw ValidationError for empty body', async () => {
      const app = setupAuthenticatedApp('user')
      const accountScopedKey = `${TEST_ACCOUNT_ID}/test.jpg`

      const res = await app.request(`/storage/upload/${encodeURIComponent(accountScopedKey)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'image/jpeg',
        },
        body: new Uint8Array(0), // Empty body
      })

      expect(res.status).toBe(400)
      const body = await res.text()
      expect(body).toContain('Request body is empty')
    })

    it('should throw ValidationError when R2 not configured', async () => {
      const app = setupAppWithoutR2('user')
      const accountScopedKey = `${TEST_ACCOUNT_ID}/test.jpg`

      const fileContent = new Uint8Array([0x89, 0x50, 0x4e, 0x47])
      const res = await app.request(`/storage/upload/${encodeURIComponent(accountScopedKey)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'image/png',
        },
        body: fileContent,
      })

      expect(res.status).toBe(400)
      const body = await res.text()
      expect(body).toContain('R2 storage is not configured')
    })

    it('should throw ValidationError when R2_PUBLIC_URL not configured', async () => {
      const app = setupAppWithoutPublicUrl('user')
      const accountScopedKey = `${TEST_ACCOUNT_ID}/test.jpg`

      const fileContent = new Uint8Array([0x89, 0x50, 0x4e, 0x47])
      const res = await app.request(`/storage/upload/${encodeURIComponent(accountScopedKey)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'image/png',
        },
        body: fileContent,
      })

      expect(res.status).toBe(400)
      const body = await res.text()
      expect(body).toContain('R2 public URL is not configured')
    })

    it('should throw ValidationError when accountId not in context', async () => {
      const app = setupAppWithoutAccountId('user')
      const accountScopedKey = `${TEST_ACCOUNT_ID}/test.jpg`

      const fileContent = new Uint8Array([0x89, 0x50, 0x4e, 0x47])
      const res = await app.request(`/storage/upload/${encodeURIComponent(accountScopedKey)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'image/png',
        },
        body: fileContent,
      })

      expect(res.status).toBe(400)
      const body = await res.text()
      expect(body).toContain('Account context is required for storage operations')
    })

    it('should decode URL-encoded keys with account prefix', async () => {
      const accountScopedKey = `${TEST_ACCOUNT_ID}/path/with spaces/file.jpg`
      const mockR2Object = {
        key: accountScopedKey,
        size: 100,
        httpEtag: '"abc123"',
        uploaded: new Date(),
      }

      vi.mocked(uploadFile).mockResolvedValue(mockR2Object as any)

      const app = setupAuthenticatedApp('user')

      const fileContent = new Uint8Array([0x89, 0x50, 0x4e, 0x47])
      const res = await app.request(`/storage/upload/${encodeURIComponent(accountScopedKey)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'image/jpeg',
        },
        body: fileContent,
      })

      expect(res.status).toBe(200)
      expect(uploadFile).toHaveBeenCalledWith(
        mockEnv.R2_BUCKET,
        accountScopedKey,
        expect.any(ArrayBuffer),
        'image/jpeg'
      )
    })

    it('should use default content-type when header is not provided', async () => {
      const accountScopedKey = `${TEST_ACCOUNT_ID}/data/file.bin`
      const mockR2Object = {
        key: accountScopedKey,
        size: 100,
        httpEtag: '"abc123"',
        uploaded: new Date(),
      }

      vi.mocked(uploadFile).mockResolvedValue(mockR2Object as any)

      const app = setupAuthenticatedApp('user')

      const fileContent = new Uint8Array([0x00, 0x01, 0x02, 0x03])
      const res = await app.request(`/storage/upload/${encodeURIComponent(accountScopedKey)}`, {
        method: 'PUT',
        // Note: No Content-Type header provided
        body: fileContent,
      })

      expect(res.status).toBe(200)
      // Should fall back to application/octet-stream
      expect(uploadFile).toHaveBeenCalledWith(
        mockEnv.R2_BUCKET,
        accountScopedKey,
        expect.any(ArrayBuffer),
        'application/octet-stream'
      )
    })

    it('should handle publicUrl with trailing slash correctly', async () => {
      const accountScopedKey = `${TEST_ACCOUNT_ID}/images/test.jpg`
      const mockR2Object = {
        key: accountScopedKey,
        size: 100,
        httpEtag: '"abc123"',
        uploaded: new Date(),
      }

      vi.mocked(uploadFile).mockResolvedValue(mockR2Object as any)

      const app = setupAppWithTrailingSlashUrl('user')

      const fileContent = new Uint8Array([0x89, 0x50, 0x4e, 0x47])
      const res = await app.request(`/storage/upload/${encodeURIComponent(accountScopedKey)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'image/png',
        },
        body: fileContent,
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      // With trailing slash, publicUrl should not add extra slash
      expect(body.publicUrl).toBe(`https://r2-test.example.com/${accountScopedKey}`)
    })
  })

  describe('DELETE /storage/{key} (deleteFileHandler)', () => {
    it('should delete file with account-scoped key', async () => {
      const accountScopedKey = `${TEST_ACCOUNT_ID}/test.jpg`
      const mockMetadata = {
        key: accountScopedKey,
        size: 100,
        httpEtag: '"abc123"',
        uploaded: new Date(),
      }

      vi.mocked(getFileMetadata).mockResolvedValue(mockMetadata as any)
      vi.mocked(deleteFile).mockResolvedValue()

      const app = setupAuthenticatedApp('user')

      const res = await app.request(`/storage/${encodeURIComponent(accountScopedKey)}`, {
        method: 'DELETE',
      })

      expect(res.status).toBe(204)
      expect(getFileMetadata).toHaveBeenCalledWith(mockEnv.R2_BUCKET, accountScopedKey)
      expect(deleteFile).toHaveBeenCalledWith(mockEnv.R2_BUCKET, accountScopedKey)
    })

    it('should reject deletion of key not scoped to current account (ADR-001 Invariante 8)', async () => {
      const app = setupAuthenticatedApp('user')

      // Try to delete from a different account's path
      const res = await app.request('/storage/other-account-id%2Ftest.jpg', {
        method: 'DELETE',
      })

      expect(res.status).toBe(403)
      const body = await res.text()
      expect(body).toContain('Access denied')
    })

    it('should throw NotFoundError for non-existent file', async () => {
      const accountScopedKey = `${TEST_ACCOUNT_ID}/non-existent.jpg`
      vi.mocked(getFileMetadata).mockResolvedValue(null)

      const app = setupAuthenticatedApp('user')

      const res = await app.request(`/storage/${encodeURIComponent(accountScopedKey)}`, {
        method: 'DELETE',
      })

      expect(res.status).toBe(404)
      const body = await res.text()
      expect(body).toContain('not found')
    })

    it('should throw ValidationError when R2 not configured', async () => {
      const app = setupAppWithoutR2('user')
      const accountScopedKey = `${TEST_ACCOUNT_ID}/test.jpg`

      const res = await app.request(`/storage/${encodeURIComponent(accountScopedKey)}`, {
        method: 'DELETE',
      })

      expect(res.status).toBe(400)
      const body = await res.text()
      expect(body).toContain('R2 storage is not configured')
    })

    it('should throw ValidationError when accountId not in context', async () => {
      const app = setupAppWithoutAccountId('user')
      const accountScopedKey = `${TEST_ACCOUNT_ID}/test.jpg`

      const res = await app.request(`/storage/${encodeURIComponent(accountScopedKey)}`, {
        method: 'DELETE',
      })

      expect(res.status).toBe(400)
      const body = await res.text()
      expect(body).toContain('Account context is required for storage operations')
    })

    // Note: Role-based access control (AUTHOR/VIEWER denied) is tested via
    // the requireRole middleware which is tested separately in middleware/auth.test.ts

    it('should allow super admin to delete files', async () => {
      const accountScopedKey = `${TEST_ACCOUNT_ID}/test.jpg`
      const mockMetadata = {
        key: accountScopedKey,
        size: 100,
        httpEtag: '"abc123"',
        uploaded: new Date(),
      }

      vi.mocked(getFileMetadata).mockResolvedValue(mockMetadata as any)
      vi.mocked(deleteFile).mockResolvedValue()

      const app = setupAuthenticatedApp('viewer', true)

      const res = await app.request(`/storage/${encodeURIComponent(accountScopedKey)}`, {
        method: 'DELETE',
      })

      expect(res.status).toBe(204)
    })

    it('should allow ADMIN role', async () => {
      const accountScopedKey = `${TEST_ACCOUNT_ID}/test.jpg`
      const mockMetadata = {
        key: accountScopedKey,
        size: 100,
        httpEtag: '"abc123"',
        uploaded: new Date(),
      }

      vi.mocked(getFileMetadata).mockResolvedValue(mockMetadata as any)
      vi.mocked(deleteFile).mockResolvedValue()

      const app = setupAuthenticatedApp('admin')

      const res = await app.request(`/storage/${encodeURIComponent(accountScopedKey)}`, {
        method: 'DELETE',
      })

      expect(res.status).toBe(204)
    })

    it('should decode URL-encoded keys for deletion with account prefix', async () => {
      const accountScopedKey = `${TEST_ACCOUNT_ID}/folder/sub folder/file.jpg`
      const mockMetadata = {
        key: accountScopedKey,
        size: 100,
        httpEtag: '"abc123"',
        uploaded: new Date(),
      }

      vi.mocked(getFileMetadata).mockResolvedValue(mockMetadata as any)
      vi.mocked(deleteFile).mockResolvedValue()

      const app = setupAuthenticatedApp('user')

      const res = await app.request(`/storage/${encodeURIComponent(accountScopedKey)}`, {
        method: 'DELETE',
      })

      expect(res.status).toBe(204)
      expect(getFileMetadata).toHaveBeenCalledWith(mockEnv.R2_BUCKET, accountScopedKey)
      expect(deleteFile).toHaveBeenCalledWith(mockEnv.R2_BUCKET, accountScopedKey)
    })
  })
})
