// src/server/routes/storage/__tests__/handlers.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { HonoEnv } from '../../../types'
import { storage } from '../index'
import { createMockEnv } from '../../../__tests__/setup'
import { createUserFixture, createAccountFixture } from '../../../__tests__/fixtures'

// Mock the r2-storage lib
vi.mock('../../../lib/r2-storage', () => ({
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
} from '../../../lib/r2-storage'

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
  function setupAuthenticatedApp(userRole: string = 'AUTHOR', isSuperAdmin: boolean = false) {
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
  function setupAppWithoutR2(userRole: string = 'AUTHOR') {
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

  describe('POST /storage/upload-url (generateUploadUrlHandler)', () => {
    it('should return upload URL', async () => {
      const mockResult = {
        url: '/api/storage/upload/images%2F1703123456789-test.jpg',
        name: 'images/1703123456789-test.jpg',
        publicUrl: 'https://r2-test.example.com/images/1703123456789-test.jpg',
      }

      vi.mocked(generateUploadUrl).mockResolvedValue(mockResult)

      const app = setupAuthenticatedApp('AUTHOR')

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
      expect(generateUploadUrl).toHaveBeenCalledWith(
        mockEnv.R2_BUCKET,
        mockEnv.R2_PUBLIC_URL,
        'images/test.jpg',
        'image/jpeg'
      )
    })

    it('should throw ValidationError when R2 not configured', async () => {
      const app = setupAppWithoutR2('AUTHOR')

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

    it('should require AUTHOR role or higher', async () => {
      const app = setupAuthenticatedApp('VIEWER')

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
        url: '/api/storage/upload/test.jpg',
        name: 'test.jpg',
        publicUrl: 'https://r2-test.example.com/test.jpg',
      }

      vi.mocked(generateUploadUrl).mockResolvedValue(mockResult)

      const app = setupAuthenticatedApp('EDITOR')

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
    it('should upload file successfully', async () => {
      const mockR2Object = {
        key: 'images/test.jpg',
        size: 100,
        httpEtag: '"abc123"',
        uploaded: new Date(),
      }

      vi.mocked(uploadFile).mockResolvedValue(mockR2Object as any)

      const app = setupAuthenticatedApp('AUTHOR')

      const fileContent = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) // PNG magic bytes
      const res = await app.request('/storage/upload/images%2Ftest.jpg', {
        method: 'PUT',
        headers: {
          'Content-Type': 'image/png',
        },
        body: fileContent,
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.key).toBe('images/test.jpg')
      expect(body.publicUrl).toContain('images/test.jpg')
      expect(uploadFile).toHaveBeenCalledWith(
        mockEnv.R2_BUCKET,
        'images/test.jpg',
        expect.any(ArrayBuffer),
        'image/png'
      )
    })

    it('should throw ValidationError for empty body', async () => {
      const app = setupAuthenticatedApp('AUTHOR')

      const res = await app.request('/storage/upload/test.jpg', {
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
      const app = setupAppWithoutR2('AUTHOR')

      const fileContent = new Uint8Array([0x89, 0x50, 0x4e, 0x47])
      const res = await app.request('/storage/upload/test.jpg', {
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

    it('should decode URL-encoded keys', async () => {
      const mockR2Object = {
        key: 'path/with spaces/file.jpg',
        size: 100,
        httpEtag: '"abc123"',
        uploaded: new Date(),
      }

      vi.mocked(uploadFile).mockResolvedValue(mockR2Object as any)

      const app = setupAuthenticatedApp('AUTHOR')

      const fileContent = new Uint8Array([0x89, 0x50, 0x4e, 0x47])
      const res = await app.request('/storage/upload/path%2Fwith%20spaces%2Ffile.jpg', {
        method: 'PUT',
        headers: {
          'Content-Type': 'image/jpeg',
        },
        body: fileContent,
      })

      expect(res.status).toBe(200)
      expect(uploadFile).toHaveBeenCalledWith(
        mockEnv.R2_BUCKET,
        'path/with spaces/file.jpg',
        expect.any(ArrayBuffer),
        'image/jpeg'
      )
    })
  })

  describe('DELETE /storage/{key} (deleteFileHandler)', () => {
    it('should delete file', async () => {
      const mockMetadata = {
        key: 'test.jpg',
        size: 100,
        httpEtag: '"abc123"',
        uploaded: new Date(),
      }

      vi.mocked(getFileMetadata).mockResolvedValue(mockMetadata as any)
      vi.mocked(deleteFile).mockResolvedValue(undefined)

      const app = setupAuthenticatedApp('EDITOR')

      const res = await app.request('/storage/test.jpg', {
        method: 'DELETE',
      })

      expect(res.status).toBe(204)
      expect(getFileMetadata).toHaveBeenCalledWith(mockEnv.R2_BUCKET, 'test.jpg')
      expect(deleteFile).toHaveBeenCalledWith(mockEnv.R2_BUCKET, 'test.jpg')
    })

    it('should throw NotFoundError for non-existent file', async () => {
      vi.mocked(getFileMetadata).mockResolvedValue(null)

      const app = setupAuthenticatedApp('EDITOR')

      const res = await app.request('/storage/non-existent.jpg', {
        method: 'DELETE',
      })

      expect(res.status).toBe(404)
      const body = await res.text()
      expect(body).toContain('not found')
    })

    it('should throw ValidationError when R2 not configured', async () => {
      const app = setupAppWithoutR2('EDITOR')

      const res = await app.request('/storage/test.jpg', {
        method: 'DELETE',
      })

      expect(res.status).toBe(400)
      const body = await res.text()
      expect(body).toContain('R2 storage is not configured')
    })

    // Note: Role-based access control (AUTHOR/VIEWER denied) is tested via
    // the requireRole middleware which is tested separately in middleware/auth.test.ts

    it('should allow super admin to delete files', async () => {
      const mockMetadata = {
        key: 'test.jpg',
        size: 100,
        httpEtag: '"abc123"',
        uploaded: new Date(),
      }

      vi.mocked(getFileMetadata).mockResolvedValue(mockMetadata as any)
      vi.mocked(deleteFile).mockResolvedValue(undefined)

      const app = setupAuthenticatedApp('VIEWER', true)

      const res = await app.request('/storage/test.jpg', {
        method: 'DELETE',
      })

      expect(res.status).toBe(204)
    })

    it('should allow ADMIN role', async () => {
      const mockMetadata = {
        key: 'test.jpg',
        size: 100,
        httpEtag: '"abc123"',
        uploaded: new Date(),
      }

      vi.mocked(getFileMetadata).mockResolvedValue(mockMetadata as any)
      vi.mocked(deleteFile).mockResolvedValue(undefined)

      const app = setupAuthenticatedApp('ADMIN')

      const res = await app.request('/storage/test.jpg', {
        method: 'DELETE',
      })

      expect(res.status).toBe(204)
    })

    it('should decode URL-encoded keys for deletion', async () => {
      const mockMetadata = {
        key: 'folder/sub folder/file.jpg',
        size: 100,
        httpEtag: '"abc123"',
        uploaded: new Date(),
      }

      vi.mocked(getFileMetadata).mockResolvedValue(mockMetadata as any)
      vi.mocked(deleteFile).mockResolvedValue(undefined)

      const app = setupAuthenticatedApp('EDITOR')

      const res = await app.request('/storage/folder%2Fsub%20folder%2Ffile.jpg', {
        method: 'DELETE',
      })

      expect(res.status).toBe(204)
      expect(getFileMetadata).toHaveBeenCalledWith(mockEnv.R2_BUCKET, 'folder/sub folder/file.jpg')
      expect(deleteFile).toHaveBeenCalledWith(mockEnv.R2_BUCKET, 'folder/sub folder/file.jpg')
    })
  })
})
