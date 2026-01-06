// tests/unit/server/routes/account/handlers.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { HonoEnv } from '@server/types'
import { account } from '@server/routes/index'
import { createMockEnv } from '@tests/helpers/server'
import { createUserFixture, createAccountFixture } from '@tests/fixtures/server'

// Mock the sql.ts functions
vi.mock('@server/db/sql', () => ({
  queryOne: vi.fn(),
  queryAll: vi.fn(),
  execute: vi.fn(),
  toStringValue: (value: unknown) => {
    if (typeof value === 'string') return value
    if (typeof value === 'number' || typeof value === 'bigint') return String(value)
    return ''
  },
  toNullableString: (value: unknown) => {
    if (value === null || value === undefined) return null
    if (typeof value === 'string') return value
    if (typeof value === 'number' || typeof value === 'bigint') return String(value)
    return null
  },
}))

// Mock the r2-storage lib
vi.mock('@server/lib/r2-storage', () => ({
  generateUploadUrl: vi.fn(),
  uploadFile: vi.fn(),
  deleteFile: vi.fn(),
  getFileMetadata: vi.fn(),
}))

// Mock the audit lib
vi.mock('@server/lib/audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}))

import { queryOne, queryAll, execute } from '@server/db/sql'
import { generateUploadUrl, deleteFile } from '@server/lib/r2-storage'
import { logAudit } from '@server/lib/audit'

// Test UUIDs
const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440001'
const TEST_ACCOUNT_ID = '550e8400-e29b-41d4-a716-446655440101'
const TEST_MEMBER_ID = '550e8400-e29b-41d4-a716-446655440201'

describe('Account Branding Routes', () => {
  let mockEnv: ReturnType<typeof createMockEnv>
  let testUser: ReturnType<typeof createUserFixture>
  let testAccount: ReturnType<typeof createAccountFixture>

  beforeEach(() => {
    vi.clearAllMocks()
    mockEnv = createMockEnv()
    testUser = createUserFixture({ id: TEST_USER_ID, email: 'test@example.com' })
    testAccount = createAccountFixture({ id: TEST_ACCOUNT_ID })
  })

  function setupAuthenticatedApp(userRole = 'user', isSuperAdmin = false) {
    const app = new Hono<HonoEnv>()

    app.use('*', async (c, next) => {
      ;(c as any).env = mockEnv
      c.set('transactionId', 'test-transaction-id')
      c.set('ip', '127.0.0.1')
      c.set('userAgent', 'TestAgent/1.0')
      c.set('user', { ...testUser, isSuperAdmin })
      c.set('accountId', testAccount.id)
      c.set('userRole', userRole)
      c.set('isSystemAdminAccess', isSuperAdmin)
      await next()
    })

    app.route('/account', account)
    return app
  }

  function setupAppWithoutR2(userRole = 'admin') {
    const app = new Hono<HonoEnv>()
    const envWithoutR2 = { ...mockEnv, R2_BUCKET: undefined }

    app.use('*', async (c, next) => {
      ;(c as any).env = envWithoutR2
      c.set('transactionId', 'test-transaction-id')
      c.set('ip', '127.0.0.1')
      c.set('userAgent', 'TestAgent/1.0')
      c.set('user', testUser)
      c.set('accountId', testAccount.id)
      c.set('userRole', userRole)
      c.set('isSystemAdminAccess', false)
      await next()
    })

    app.route('/account', account)
    return app
  }

  function setupAppWithoutDB(userRole = 'admin') {
    const app = new Hono<HonoEnv>()
    // Create env without DB but with R2
    const envWithoutDB = { ...mockEnv, DB: undefined }

    app.use('*', async (c, next) => {
      ;(c as any).env = envWithoutDB
      c.set('transactionId', 'test-transaction-id')
      c.set('ip', '127.0.0.1')
      c.set('userAgent', 'TestAgent/1.0')
      c.set('user', testUser)
      c.set('accountId', testAccount.id)
      c.set('userRole', userRole)
      c.set('isSystemAdminAccess', false)
      // Note: Do not set 'db' either to simulate DB not initialized
      await next()
    })

    app.route('/account', account)
    return app
  }

  describe('POST /account/branding/logo (uploadLogoHandler)', () => {
    it('should return upload URL for admin', async () => {
      const mockResult = {
        url: '/api/storage/upload/acc_123%2Fbranding%2Flogo-test.jpg',
        name: `${TEST_ACCOUNT_ID}/branding/logo-test.jpg`,
        publicUrl: `https://r2-test.example.com/${TEST_ACCOUNT_ID}/branding/logo-test.jpg`,
      }

      vi.mocked(generateUploadUrl).mockReturnValue(mockResult)

      const app = setupAuthenticatedApp('admin')

      const res = await app.request('/account/branding/logo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.uploadUrl).toBe(mockResult.url)
      expect(body.key).toBe(mockResult.name)
      expect(body.publicUrl).toBe(mockResult.publicUrl)
      expect(logAudit).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: 'LOGO_UPLOAD_INITIATED',
        })
      )
    })

    it('should require admin role', async () => {
      const app = setupAuthenticatedApp('user')

      const res = await app.request('/account/branding/logo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        }),
      })

      expect(res.status).toBe(403)
    })

    it('should require manager role to be denied', async () => {
      const app = setupAuthenticatedApp('manager')

      const res = await app.request('/account/branding/logo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        }),
      })

      expect(res.status).toBe(403)
    })

    it('should fail when R2 not configured', async () => {
      const app = setupAppWithoutR2('admin')

      const res = await app.request('/account/branding/logo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        }),
      })

      expect(res.status).toBe(500)
    })

    it('should fail when DB not initialized', async () => {
      const app = setupAppWithoutDB('admin')

      const res = await app.request('/account/branding/logo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        }),
      })

      expect(res.status).toBe(500)
      const body = await res.text()
      expect(body).toContain('Database not initialized')
    })
  })

  describe('POST /account/branding/favicon (uploadFaviconHandler)', () => {
    it('should return upload URL for admin', async () => {
      const mockResult = {
        url: '/api/storage/upload/acc_123%2Fbranding%2Ffavicon-test.ico',
        name: `${TEST_ACCOUNT_ID}/branding/favicon-test.ico`,
        publicUrl: `https://r2-test.example.com/${TEST_ACCOUNT_ID}/branding/favicon-test.ico`,
      }

      vi.mocked(generateUploadUrl).mockReturnValue(mockResult)

      const app = setupAuthenticatedApp('admin')

      const res = await app.request('/account/branding/favicon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'test.ico',
          contentType: 'image/x-icon',
        }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.uploadUrl).toBe(mockResult.url)
      expect(logAudit).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: 'FAVICON_UPLOAD_INITIATED',
        })
      )
    })

    it('should require admin role', async () => {
      const app = setupAuthenticatedApp('viewer')

      const res = await app.request('/account/branding/favicon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'test.ico',
          contentType: 'image/x-icon',
        }),
      })

      expect(res.status).toBe(403)
    })

    it('should fail when R2 not configured', async () => {
      const app = setupAppWithoutR2('admin')

      const res = await app.request('/account/branding/favicon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'test.ico',
          contentType: 'image/x-icon',
        }),
      })

      expect(res.status).toBe(500)
    })

    it('should fail when DB not initialized', async () => {
      const app = setupAppWithoutDB('admin')

      const res = await app.request('/account/branding/favicon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'test.ico',
          contentType: 'image/x-icon',
        }),
      })

      expect(res.status).toBe(500)
      const body = await res.text()
      expect(body).toContain('Database not initialized')
    })
  })

  describe('DELETE /account/branding/logo (deleteLogoHandler)', () => {
    it('should delete logo for admin', async () => {
      const logoUrl = `https://r2-test.example.com/${TEST_ACCOUNT_ID}/branding/logo-test.jpg`

      vi.mocked(queryOne).mockResolvedValue({ logo_url: logoUrl })
      vi.mocked(execute).mockResolvedValue({ meta: { changes: 1 } } as any)
      vi.mocked(deleteFile).mockResolvedValue(undefined)

      const app = setupAuthenticatedApp('admin')

      const res = await app.request('/account/branding/logo', {
        method: 'DELETE',
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.message).toBe('Logo deleted successfully')
      expect(deleteFile).toHaveBeenCalled()
      expect(logAudit).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: 'LOGO_DELETED',
        })
      )
    })

    it('should return 404 when no logo exists', async () => {
      vi.mocked(queryOne).mockResolvedValue({ logo_url: null })

      const app = setupAuthenticatedApp('admin')

      const res = await app.request('/account/branding/logo', {
        method: 'DELETE',
      })

      expect(res.status).toBe(404)
    })

    it('should require admin role', async () => {
      const app = setupAuthenticatedApp('user')

      const res = await app.request('/account/branding/logo', {
        method: 'DELETE',
      })

      expect(res.status).toBe(403)
    })

    it('should fail when R2 not configured', async () => {
      const app = setupAppWithoutR2('admin')

      const res = await app.request('/account/branding/logo', {
        method: 'DELETE',
      })

      expect(res.status).toBe(500)
    })

    it('should fail when DB not initialized', async () => {
      const app = setupAppWithoutDB('admin')

      const res = await app.request('/account/branding/logo', {
        method: 'DELETE',
      })

      expect(res.status).toBe(500)
      const body = await res.text()
      expect(body).toContain('Database not initialized')
    })

    it('should handle path-based URLs', async () => {
      vi.mocked(queryOne).mockResolvedValue({ logo_url: '/some/path/logo.png' })
      vi.mocked(execute).mockResolvedValue({ meta: { changes: 1 } } as any)
      vi.mocked(deleteFile).mockResolvedValue(undefined)

      const app = setupAuthenticatedApp('admin')

      const res = await app.request('/account/branding/logo', {
        method: 'DELETE',
      })

      expect(res.status).toBe(200)
      expect(deleteFile).toHaveBeenCalledWith(mockEnv.R2_BUCKET, 'some/path/logo.png')
    })

    it('should handle simple key URLs', async () => {
      vi.mocked(queryOne).mockResolvedValue({ logo_url: 'simple-logo.png' })
      vi.mocked(execute).mockResolvedValue({ meta: { changes: 1 } } as any)
      vi.mocked(deleteFile).mockResolvedValue(undefined)

      const app = setupAuthenticatedApp('admin')

      const res = await app.request('/account/branding/logo', {
        method: 'DELETE',
      })

      expect(res.status).toBe(200)
      expect(deleteFile).toHaveBeenCalledWith(mockEnv.R2_BUCKET, 'simple-logo.png')
    })
  })

  describe('DELETE /account/branding/favicon (deleteFaviconHandler)', () => {
    it('should delete favicon for admin', async () => {
      const faviconUrl = `https://r2-test.example.com/${TEST_ACCOUNT_ID}/branding/favicon-test.ico`

      vi.mocked(queryOne).mockResolvedValue({ favicon_url: faviconUrl })
      vi.mocked(execute).mockResolvedValue({ meta: { changes: 1 } } as any)
      vi.mocked(deleteFile).mockResolvedValue(undefined)

      const app = setupAuthenticatedApp('admin')

      const res = await app.request('/account/branding/favicon', {
        method: 'DELETE',
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.message).toBe('Favicon deleted successfully')
      expect(logAudit).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: 'FAVICON_DELETED',
        })
      )
    })

    it('should return 404 when no favicon exists', async () => {
      vi.mocked(queryOne).mockResolvedValue({ favicon_url: null })

      const app = setupAuthenticatedApp('admin')

      const res = await app.request('/account/branding/favicon', {
        method: 'DELETE',
      })

      expect(res.status).toBe(404)
    })

    it('should require admin role', async () => {
      const app = setupAuthenticatedApp('manager')

      const res = await app.request('/account/branding/favicon', {
        method: 'DELETE',
      })

      expect(res.status).toBe(403)
    })

    it('should fail when R2 not configured', async () => {
      const app = setupAppWithoutR2('admin')

      const res = await app.request('/account/branding/favicon', {
        method: 'DELETE',
      })

      expect(res.status).toBe(500)
    })

    it('should fail when DB not initialized', async () => {
      const app = setupAppWithoutDB('admin')

      const res = await app.request('/account/branding/favicon', {
        method: 'DELETE',
      })

      expect(res.status).toBe(500)
      const body = await res.text()
      expect(body).toContain('Database not initialized')
    })
  })
})

describe('Account Settings Routes', () => {
  let mockEnv: ReturnType<typeof createMockEnv>
  let testUser: ReturnType<typeof createUserFixture>
  let testAccount: ReturnType<typeof createAccountFixture>

  beforeEach(() => {
    vi.clearAllMocks()
    mockEnv = createMockEnv()
    testUser = createUserFixture({ id: TEST_USER_ID, email: 'test@example.com' })
    testAccount = createAccountFixture({ id: TEST_ACCOUNT_ID })
  })

  function setupAuthenticatedApp(userRole = 'user') {
    const app = new Hono<HonoEnv>()

    app.use('*', async (c, next) => {
      ;(c as any).env = mockEnv
      c.set('transactionId', 'test-transaction-id')
      c.set('ip', '127.0.0.1')
      c.set('userAgent', 'TestAgent/1.0')
      c.set('user', testUser)
      c.set('accountId', testAccount.id)
      c.set('userRole', userRole)
      c.set('isSystemAdminAccess', false)
      await next()
    })

    app.route('/account', account)
    return app
  }

  function setupAppWithoutDB(userRole = 'admin') {
    const app = new Hono<HonoEnv>()
    const envWithoutDB = { ...mockEnv, DB: undefined }

    app.use('*', async (c, next) => {
      ;(c as any).env = envWithoutDB
      c.set('transactionId', 'test-transaction-id')
      c.set('ip', '127.0.0.1')
      c.set('userAgent', 'TestAgent/1.0')
      c.set('user', testUser)
      c.set('accountId', testAccount.id)
      c.set('userRole', userRole)
      c.set('isSystemAdminAccess', false)
      await next()
    })

    app.route('/account', account)
    return app
  }

  function setupAppWithMissingContext() {
    const app = new Hono<HonoEnv>()

    app.use('*', async (c, next) => {
      ;(c as any).env = mockEnv
      c.set('transactionId', 'test-transaction-id')
      c.set('ip', '127.0.0.1')
      c.set('userAgent', 'TestAgent/1.0')
      // Missing user and accountId to trigger missing context
      await next()
    })

    app.route('/account', account)
    return app
  }

  describe('GET /account/settings (getAccountSettingsHandler)', () => {
    it('should return account settings', async () => {
      vi.mocked(queryOne).mockResolvedValue({
        id: TEST_ACCOUNT_ID,
        name: 'Test Account',
        description: 'A test account',
        domain: null,
        status: 'active',
        logo_url: null,
        favicon_url: null,
        primary_color: '#007bff',
        secondary_color: null,
        accent_color: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      const app = setupAuthenticatedApp('viewer')

      const res = await app.request('/account/settings', {
        method: 'GET',
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.id).toBe(TEST_ACCOUNT_ID)
      expect(body.data.name).toBe('Test Account')
      expect(body.data.status).toBe('active')
      expect(body.data.primaryColor).toBe('#007bff')
    })

    it('should return suspended status correctly', async () => {
      vi.mocked(queryOne).mockResolvedValue({
        id: TEST_ACCOUNT_ID,
        name: 'Suspended Account',
        description: null,
        domain: null,
        status: 'suspended',
        logo_url: null,
        favicon_url: null,
        primary_color: null,
        secondary_color: null,
        accent_color: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      const app = setupAuthenticatedApp('viewer')

      const res = await app.request('/account/settings', {
        method: 'GET',
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.status).toBe('suspended')
    })

    it('should return 404 when account not found', async () => {
      vi.mocked(queryOne).mockResolvedValue(null)

      const app = setupAuthenticatedApp('viewer')

      const res = await app.request('/account/settings', {
        method: 'GET',
      })

      expect(res.status).toBe(404)
    })

    it('should return 500 when DB not initialized', async () => {
      const app = setupAppWithoutDB('viewer')

      const res = await app.request('/account/settings', {
        method: 'GET',
      })

      expect(res.status).toBe(500)
      const body = await res.text()
      expect(body).toContain('Database not initialized')
    })

    it('should return 500 when missing required context', async () => {
      const app = setupAppWithMissingContext()

      const res = await app.request('/account/settings', {
        method: 'GET',
      })

      expect(res.status).toBe(500)
      const body = await res.text()
      expect(body).toContain('Missing required context')
    })
  })

  describe('PATCH /account/settings (updateAccountSettingsHandler)', () => {
    it('should update account settings for admin', async () => {
      // Only mock the post-update fetch (no domain check needed since we're not sending domain)
      vi.mocked(queryOne).mockResolvedValueOnce({
        id: TEST_ACCOUNT_ID,
        name: 'Updated Account',
        description: null,
        domain: null,
        status: 'active',
        logo_url: null,
        favicon_url: null,
        primary_color: '#ff0000',
        secondary_color: null,
        accent_color: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      vi.mocked(execute).mockResolvedValue({ meta: { changes: 1 } } as any)

      const app = setupAuthenticatedApp('admin')

      const res = await app.request('/account/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Updated Account',
          primaryColor: '#ff0000',
        }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.name).toBe('Updated Account')
      expect(body.data.primaryColor).toBe('#ff0000')
      expect(logAudit).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: 'SETTINGS_UPDATED',
        })
      )
    })

    it('should require admin role', async () => {
      const app = setupAuthenticatedApp('manager')

      const res = await app.request('/account/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Updated Account',
        }),
      })

      expect(res.status).toBe(403)
    })

    it('should update all branding fields', async () => {
      // Only mock the post-update fetch (no domain check needed since we're not sending domain)
      vi.mocked(queryOne).mockResolvedValueOnce({
        id: TEST_ACCOUNT_ID,
        name: 'Account',
        description: null,
        domain: null,
        status: 'active',
        logo_url: 'https://r2.example.com/logo.png',
        favicon_url: 'https://r2.example.com/favicon.ico',
        primary_color: '#ff0000',
        secondary_color: '#00ff00',
        accent_color: '#0000ff',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      vi.mocked(execute).mockResolvedValue({ meta: { changes: 1 } } as any)

      const app = setupAuthenticatedApp('admin')

      const res = await app.request('/account/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logoUrl: 'https://r2.example.com/logo.png',
          faviconUrl: 'https://r2.example.com/favicon.ico',
          primaryColor: '#ff0000',
          secondaryColor: '#00ff00',
          accentColor: '#0000ff',
        }),
      })

      expect(res.status).toBe(200)
    })

    it('should return 409 when domain already in use', async () => {
      vi.mocked(queryOne).mockResolvedValue({ id: 'other-account-id' })

      const app = setupAuthenticatedApp('admin')

      const res = await app.request('/account/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: 'taken-domain.com',
        }),
      })

      expect(res.status).toBe(409)
    })

    it('should return 500 when failed to fetch updated account', async () => {
      // No domain in request, so no domain check - only post-update fetch (returns null = failure)
      vi.mocked(queryOne).mockResolvedValueOnce(null) // Failed to fetch updated
      vi.mocked(execute).mockResolvedValue({ meta: { changes: 1 } } as any)

      const app = setupAuthenticatedApp('admin')

      const res = await app.request('/account/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Updated Account',
        }),
      })

      expect(res.status).toBe(500)
    })

    it('should return 500 when DB not initialized', async () => {
      const app = setupAppWithoutDB('admin')

      const res = await app.request('/account/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Updated Account',
        }),
      })

      expect(res.status).toBe(500)
      const body = await res.text()
      expect(body).toContain('Database not initialized')
    })
  })
})

describe('Account Members Routes', () => {
  let mockEnv: ReturnType<typeof createMockEnv>
  let testUser: ReturnType<typeof createUserFixture>
  let testAccount: ReturnType<typeof createAccountFixture>

  beforeEach(() => {
    vi.clearAllMocks()
    mockEnv = createMockEnv()
    testUser = createUserFixture({ id: TEST_USER_ID, email: 'test@example.com' })
    testAccount = createAccountFixture({ id: TEST_ACCOUNT_ID })
  })

  function setupAuthenticatedApp(userRole = 'user') {
    const app = new Hono<HonoEnv>()

    app.use('*', async (c, next) => {
      ;(c as any).env = mockEnv
      c.set('transactionId', 'test-transaction-id')
      c.set('ip', '127.0.0.1')
      c.set('userAgent', 'TestAgent/1.0')
      c.set('user', testUser)
      c.set('accountId', testAccount.id)
      c.set('userRole', userRole)
      c.set('isSystemAdminAccess', false)
      await next()
    })

    app.route('/account', account)
    return app
  }

  function setupAppWithoutDB(userRole = 'admin') {
    const app = new Hono<HonoEnv>()
    const envWithoutDB = { ...mockEnv, DB: undefined }

    app.use('*', async (c, next) => {
      ;(c as any).env = envWithoutDB
      c.set('transactionId', 'test-transaction-id')
      c.set('ip', '127.0.0.1')
      c.set('userAgent', 'TestAgent/1.0')
      c.set('user', testUser)
      c.set('accountId', testAccount.id)
      c.set('userRole', userRole)
      c.set('isSystemAdminAccess', false)
      await next()
    })

    app.route('/account', account)
    return app
  }

  describe('GET /account/members (listMembersHandler)', () => {
    it('should list members with pagination', async () => {
      vi.mocked(queryOne).mockResolvedValue({ count: 2 })
      vi.mocked(queryAll).mockResolvedValue([
        { id: TEST_USER_ID, email: 'user1@example.com', name: 'User 1', avatar_url: null, role: 'admin', created_at: new Date().toISOString() },
        { id: TEST_MEMBER_ID, email: 'user2@example.com', name: 'User 2', avatar_url: null, role: 'user', created_at: new Date().toISOString() },
      ])

      const app = setupAuthenticatedApp('viewer')

      const res = await app.request('/account/members?page=1&limit=10', {
        method: 'GET',
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(2)
      expect(body.meta.currentPage).toBe(1)
      expect(body.meta.limit).toBe(10)
      expect(body.meta.totalItems).toBe(2)
    })

    it('should handle empty members list', async () => {
      vi.mocked(queryOne).mockResolvedValue({ count: 0 })
      vi.mocked(queryAll).mockResolvedValue([])

      const app = setupAuthenticatedApp('viewer')

      const res = await app.request('/account/members?page=1&limit=10', {
        method: 'GET',
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(0)
    })

    it('should return 500 when DB not initialized', async () => {
      const app = setupAppWithoutDB('viewer')

      const res = await app.request('/account/members?page=1&limit=10', {
        method: 'GET',
      })

      expect(res.status).toBe(500)
      const body = await res.text()
      expect(body).toContain('Database not initialized')
    })
  })

  describe('PATCH /account/members/:userId (updateMemberRoleHandler)', () => {
    it('should update member role for admin', async () => {
      vi.mocked(queryOne).mockResolvedValue({
        id: TEST_MEMBER_ID,
        email: 'member@example.com',
        name: 'Member User',
        avatar_url: null,
        role: 'user',
        created_at: new Date().toISOString(),
      })
      vi.mocked(execute).mockResolvedValue({ meta: { changes: 1 } } as any)

      const app = setupAuthenticatedApp('admin')

      const res = await app.request(`/account/members/${TEST_MEMBER_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'manager' }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.newRole).toBe('manager')
      expect(body.previousRole).toBe('user')
      expect(logAudit).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: 'ROLE_CHANGED',
        })
      )
    })

    it('should require manager role', async () => {
      const app = setupAuthenticatedApp('user')

      const res = await app.request(`/account/members/${TEST_MEMBER_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'user' }),
      })

      expect(res.status).toBe(403)
    })

    it('should not allow assigning higher role than own', async () => {
      const app = setupAuthenticatedApp('manager')

      const res = await app.request(`/account/members/${TEST_MEMBER_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'admin' }),
      })

      expect(res.status).toBe(403)
    })

    it('should return 404 when member not found', async () => {
      vi.mocked(queryOne).mockResolvedValue(null)

      const app = setupAuthenticatedApp('admin')

      const res = await app.request(`/account/members/${TEST_MEMBER_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'manager' }),
      })

      expect(res.status).toBe(404)
    })

    it('should not allow modifying higher role member', async () => {
      vi.mocked(queryOne).mockResolvedValue({
        id: TEST_MEMBER_ID,
        email: 'admin@example.com',
        name: 'Admin User',
        avatar_url: null,
        role: 'admin',
        created_at: new Date().toISOString(),
      })

      const app = setupAuthenticatedApp('manager')

      const res = await app.request(`/account/members/${TEST_MEMBER_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'user' }),
      })

      expect(res.status).toBe(403)
    })

    it('should protect last admin from demotion', async () => {
      vi.mocked(queryOne).mockResolvedValue({
        id: TEST_MEMBER_ID,
        email: 'admin@example.com',
        name: 'Admin User',
        avatar_url: null,
        role: 'admin',
        created_at: new Date().toISOString(),
      })
      vi.mocked(execute).mockResolvedValue({ meta: { changes: 0 } } as any)

      const app = setupAuthenticatedApp('admin')

      const res = await app.request(`/account/members/${TEST_MEMBER_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'user' }),
      })

      expect(res.status).toBe(403)
      const body = await res.text()
      expect(body).toContain('last admin')
    })

    it('should return 500 when DB not initialized', async () => {
      const app = setupAppWithoutDB('admin')

      const res = await app.request(`/account/members/${TEST_MEMBER_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'manager' }),
      })

      expect(res.status).toBe(500)
      const body = await res.text()
      expect(body).toContain('Database not initialized')
    })
  })

  describe('DELETE /account/members/:userId (removeMemberHandler)', () => {
    it('should remove member for manager', async () => {
      vi.mocked(queryOne).mockResolvedValue({
        role: 'user',
        email: 'member@example.com',
        name: 'Member User',
      })
      vi.mocked(execute).mockResolvedValue({ meta: { changes: 1 } } as any)

      const app = setupAuthenticatedApp('manager')

      const res = await app.request(`/account/members/${TEST_MEMBER_ID}`, {
        method: 'DELETE',
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(logAudit).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: 'MEMBER_REMOVED',
        })
      )
    })

    it('should require manager role', async () => {
      const app = setupAuthenticatedApp('user')

      const res = await app.request(`/account/members/${TEST_MEMBER_ID}`, {
        method: 'DELETE',
      })

      expect(res.status).toBe(403)
    })

    it('should return 404 when member not found', async () => {
      vi.mocked(queryOne).mockResolvedValue(null)

      const app = setupAuthenticatedApp('manager')

      const res = await app.request(`/account/members/${TEST_MEMBER_ID}`, {
        method: 'DELETE',
      })

      expect(res.status).toBe(404)
    })

    it('should not allow removing higher role member (unless admin)', async () => {
      vi.mocked(queryOne).mockResolvedValue({
        role: 'admin',
        email: 'admin@example.com',
        name: 'Admin User',
      })

      const app = setupAuthenticatedApp('manager')

      const res = await app.request(`/account/members/${TEST_MEMBER_ID}`, {
        method: 'DELETE',
      })

      expect(res.status).toBe(403)
    })

    it('should protect last admin from removal', async () => {
      vi.mocked(queryOne).mockResolvedValue({
        role: 'admin',
        email: 'admin@example.com',
        name: 'Admin User',
      })
      vi.mocked(execute).mockResolvedValue({ meta: { changes: 0 } } as any)

      const app = setupAuthenticatedApp('admin')

      const res = await app.request(`/account/members/${TEST_MEMBER_ID}`, {
        method: 'DELETE',
      })

      expect(res.status).toBe(403)
      const body = await res.text()
      expect(body).toContain('last admin')
    })

    it('should allow admin to remove higher role member', async () => {
      vi.mocked(queryOne).mockResolvedValue({
        role: 'manager',
        email: 'manager@example.com',
        name: 'Manager User',
      })
      vi.mocked(execute).mockResolvedValue({ meta: { changes: 1 } } as any)

      const app = setupAuthenticatedApp('admin')

      const res = await app.request(`/account/members/${TEST_MEMBER_ID}`, {
        method: 'DELETE',
      })

      expect(res.status).toBe(200)
    })

    it('should return 500 when DB not initialized', async () => {
      const app = setupAppWithoutDB('manager')

      const res = await app.request(`/account/members/${TEST_MEMBER_ID}`, {
        method: 'DELETE',
      })

      expect(res.status).toBe(500)
      const body = await res.text()
      expect(body).toContain('Database not initialized')
    })
  })
})
