/**
 * Storage Integration Tests
 *
 * Tests the storage operations for file upload, download, and deletion:
 * - POST /api/storage/upload-url - Generate presigned upload URL (requires AUTHOR role)
 * - PUT /api/storage/upload/{key} - Upload file (requires AUTHOR role)
 * - DELETE /api/storage/{key} - Delete file (requires EDITOR role)
 *
 * Permission Matrix:
 * | Operation               | ADMIN | MANAGER | EDITOR | AUTHOR | VIEWER |
 * |-------------------------|-------|---------|--------|--------|--------|
 * | Generate upload URL     |   Y   |    Y    |   Y    |   Y    |   N    |
 * | Upload file             |   Y   |    Y    |   Y    |   Y    |   N    |
 * | Delete file             |   Y   |    Y    |   Y    |   N    |   N    |
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { Hono } from 'hono'
import { getEnv, getDb, getR2, type TestEnv, type MockR2Store } from '../setup'
import {
  createUser,
  createUserSession,
  createAccount,
  addUserToAccount,
  type Role,
} from '../fixtures'
import type { HonoEnv } from '../../../src/server/types'
import { api } from '../../../src/server/routes'
import { errorHandler } from '../../../src/server/middleware/error-handler'
import { sessionMiddleware } from '../../../src/server/lib/session'

// ============================================================================
// TEST SETUP
// ============================================================================

/**
 * Creates a D1-compatible database instance for tests
 */
function createTestDb() {
  return getDb()
}

/**
 * Helper to create a user with a specific role in an account
 */
async function createUserWithRole(
  accountId: string,
  role: Role,
  options?: { email?: string; name?: string }
): Promise<{
  user: Awaited<ReturnType<typeof createUser>>
  sessionId: string
  headers: Record<string, string>
}> {
  const user = await createUser({
    email: options?.email ?? `${role.toLowerCase()}-user-${crypto.randomUUID().slice(0, 8)}@example.com`,
    name: options?.name ?? `${role} User`,
  })

  await addUserToAccount(user.id, accountId, role)

  const { sessionId, headers } = await createUserSession(user.id, {
    email: user.email,
    name: user.name,
  })

  return { user, sessionId, headers }
}

// ============================================================================
// TESTS
// ============================================================================

describe('Storage Integration', () => {
  let app: Hono<HonoEnv>
  let env: TestEnv

  beforeAll(() => {
    env = getEnv()
    app = new Hono<HonoEnv>()

    // Set up error handler
    app.onError(errorHandler)

    // Set up middleware to inject test environment
    app.use('*', async (c, next) => {
      // Inject environment bindings
      ;(c as any).env = env

      // Set up database
      const db = createTestDb()
      c.set('db', db)

      // Set up request context variables
      c.set('transactionId', crypto.randomUUID())
      c.set('ip', '127.0.0.1')
      c.set('userAgent', 'IntegrationTest/1.0')

      await next()
    })

    // Session middleware - reads session from KV and sets sessionData in context
    app.use('*', sessionMiddleware())

    // Mount API routes (includes sessionAuth and accountMiddleware)
    app.route('/api', api)
  })

  // ============================================================================
  // POST /api/storage/upload-url - Generate Upload URL
  // ============================================================================

  describe('POST /api/storage/upload-url', () => {
    describe('Authentication (401)', () => {
      it('should return 401 without session cookie', async () => {
        const res = await app.request('/api/storage/upload-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filename: 'test.txt',
            contentType: 'text/plain',
          }),
        })

        expect(res.status).toBe(401)

        const body = await res.json()
        expect(body).toHaveProperty('error')
        expect(body.error.message).toBe('Not authenticated')
      })

      it('should return 401 with invalid session ID', async () => {
        const res = await app.request('/api/storage/upload-url', {
          method: 'POST',
          headers: {
            Cookie: 'sid=invalid-session-id-that-does-not-exist',
            'account-id': crypto.randomUUID(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filename: 'test.txt',
            contentType: 'text/plain',
          }),
        })

        expect(res.status).toBe(401)

        const body = await res.json()
        expect(body.error.message).toBe('Not authenticated')
      })
    })

    describe('Authorization (403)', () => {
      it('should return 403 if user lacks upload permission (VIEWER role)', async () => {
        const account = await createAccount({ name: 'Storage Viewer Test' })
        const { headers } = await createUserWithRole(account.id, 'VIEWER')

        const res = await app.request('/api/storage/upload-url', {
          method: 'POST',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filename: 'test.txt',
            contentType: 'text/plain',
          }),
        })

        expect(res.status).toBe(403)
      })

      it('should return 403 if BILLING role tries to upload', async () => {
        const account = await createAccount({ name: 'Storage Billing Test' })
        const { headers } = await createUserWithRole(account.id, 'BILLING')

        const res = await app.request('/api/storage/upload-url', {
          method: 'POST',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filename: 'test.txt',
            contentType: 'text/plain',
          }),
        })

        expect(res.status).toBe(403)
      })

      it('should return 403 if ANALYTICS role tries to upload', async () => {
        const account = await createAccount({ name: 'Storage Analytics Test' })
        const { headers } = await createUserWithRole(account.id, 'ANALYTICS')

        const res = await app.request('/api/storage/upload-url', {
          method: 'POST',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filename: 'test.txt',
            contentType: 'text/plain',
          }),
        })

        expect(res.status).toBe(403)
      })
    })

    describe('Validation (400)', () => {
      it('should return 400 for missing filename', async () => {
        const account = await createAccount({ name: 'Storage Validation Test' })
        const { headers } = await createUserWithRole(account.id, 'AUTHOR')

        const res = await app.request('/api/storage/upload-url', {
          method: 'POST',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contentType: 'text/plain',
          }),
        })

        expect(res.status).toBe(400)
      })

      it('should return 400 for missing contentType', async () => {
        const account = await createAccount({ name: 'Storage ContentType Test' })
        const { headers } = await createUserWithRole(account.id, 'AUTHOR')

        const res = await app.request('/api/storage/upload-url', {
          method: 'POST',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filename: 'test.txt',
          }),
        })

        expect(res.status).toBe(400)
      })

      it('should return 400 for empty filename', async () => {
        const account = await createAccount({ name: 'Storage Empty Filename Test' })
        const { headers } = await createUserWithRole(account.id, 'AUTHOR')

        const res = await app.request('/api/storage/upload-url', {
          method: 'POST',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filename: '',
            contentType: 'text/plain',
          }),
        })

        expect(res.status).toBe(400)
      })

      it('should return 400 for empty contentType', async () => {
        const account = await createAccount({ name: 'Storage Empty ContentType Test' })
        const { headers } = await createUserWithRole(account.id, 'AUTHOR')

        const res = await app.request('/api/storage/upload-url', {
          method: 'POST',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filename: 'test.txt',
            contentType: '',
          }),
        })

        expect(res.status).toBe(400)
      })
    })

    describe('Successful Upload URL Generation (200)', () => {
      it('should return 200 with upload URL for AUTHOR role', async () => {
        const account = await createAccount({ name: 'Storage Author Upload URL Test' })
        const { headers } = await createUserWithRole(account.id, 'AUTHOR')

        const res = await app.request('/api/storage/upload-url', {
          method: 'POST',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filename: 'test-file.txt',
            contentType: 'text/plain',
          }),
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body).toHaveProperty('url')
        expect(body).toHaveProperty('name')
        expect(body).toHaveProperty('publicUrl')
        expect(body.url).toContain('/api/storage/upload/')
        expect(body.name).toContain('test-file.txt')
        expect(body.publicUrl).toContain('test-file.txt')
      })

      it('should return 200 with upload URL for EDITOR role', async () => {
        const account = await createAccount({ name: 'Storage Editor Upload URL Test' })
        const { headers } = await createUserWithRole(account.id, 'EDITOR')

        const res = await app.request('/api/storage/upload-url', {
          method: 'POST',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filename: 'test-file.txt',
            contentType: 'text/plain',
          }),
        })

        expect(res.status).toBe(200)
      })

      it('should return 200 with upload URL for MANAGER role', async () => {
        const account = await createAccount({ name: 'Storage Manager Upload URL Test' })
        const { headers } = await createUserWithRole(account.id, 'MANAGER')

        const res = await app.request('/api/storage/upload-url', {
          method: 'POST',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filename: 'test-file.txt',
            contentType: 'text/plain',
          }),
        })

        expect(res.status).toBe(200)
      })

      it('should return 200 with upload URL for ADMIN role', async () => {
        const account = await createAccount({ name: 'Storage Admin Upload URL Test' })
        const { headers } = await createUserWithRole(account.id, 'ADMIN')

        const res = await app.request('/api/storage/upload-url', {
          method: 'POST',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filename: 'test-file.txt',
            contentType: 'text/plain',
          }),
        })

        expect(res.status).toBe(200)
      })

      it('should preserve folder structure in filename', async () => {
        const account = await createAccount({ name: 'Storage Folder Structure Test' })
        const { headers } = await createUserWithRole(account.id, 'AUTHOR')

        const res = await app.request('/api/storage/upload-url', {
          method: 'POST',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filename: 'images/photos/my-photo.jpg',
            contentType: 'image/jpeg',
          }),
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.name).toContain('images/')
        expect(body.name).toContain('my-photo.jpg')
        expect(body.publicUrl).toContain('images/')
      })

      it('should generate unique filename with timestamp', async () => {
        const account = await createAccount({ name: 'Storage Unique Filename Test' })
        const { headers } = await createUserWithRole(account.id, 'AUTHOR')

        // Make two requests with the same filename
        const res1 = await app.request('/api/storage/upload-url', {
          method: 'POST',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filename: 'duplicate.txt',
            contentType: 'text/plain',
          }),
        })

        // Add a small delay to ensure different timestamp
        await new Promise((resolve) => setTimeout(resolve, 2))

        const res2 = await app.request('/api/storage/upload-url', {
          method: 'POST',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filename: 'duplicate.txt',
            contentType: 'text/plain',
          }),
        })

        expect(res1.status).toBe(200)
        expect(res2.status).toBe(200)

        const body1 = await res1.json()
        const body2 = await res2.json()

        // Filenames should be different (unique with timestamp)
        expect(body1.name).not.toBe(body2.name)
      })
    })
  })

  // ============================================================================
  // PUT /api/storage/upload/{key} - Upload File
  // ============================================================================

  describe('PUT /api/storage/upload/{key}', () => {
    describe('Authentication (401)', () => {
      it('should return 401 without session cookie', async () => {
        const res = await app.request('/api/storage/upload/test-key.txt', {
          method: 'PUT',
          headers: {
            'Content-Type': 'text/plain',
          },
          body: 'test content',
        })

        expect(res.status).toBe(401)

        const body = await res.json()
        expect(body.error.message).toBe('Not authenticated')
      })
    })

    describe('Authorization (403)', () => {
      it('should return 403 if user lacks upload permission (VIEWER role)', async () => {
        const account = await createAccount({ name: 'Storage Viewer Upload Test' })
        const { headers } = await createUserWithRole(account.id, 'VIEWER')

        const res = await app.request('/api/storage/upload/test-key.txt', {
          method: 'PUT',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
            'Content-Type': 'text/plain',
          },
          body: 'test content',
        })

        expect(res.status).toBe(403)
      })
    })

    describe('Validation (400)', () => {
      it('should return 400 for empty request body', async () => {
        const account = await createAccount({ name: 'Storage Empty Body Test' })
        const { headers } = await createUserWithRole(account.id, 'AUTHOR')

        const res = await app.request('/api/storage/upload/test-key.txt', {
          method: 'PUT',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
            'Content-Type': 'text/plain',
          },
          body: '',
        })

        expect(res.status).toBe(400)

        const body = await res.json()
        expect(body.error.message).toContain('empty')
      })
    })

    describe('Successful Upload (200)', () => {
      it('should return 200 on successful text file upload', async () => {
        const account = await createAccount({ name: 'Storage Text Upload Test' })
        const { headers } = await createUserWithRole(account.id, 'AUTHOR')
        const r2 = getR2()

        const fileKey = `test-${Date.now()}.txt`
        const fileContent = 'Hello, World!'

        const res = await app.request(`/api/storage/upload/${encodeURIComponent(fileKey)}`, {
          method: 'PUT',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
            'Content-Type': 'text/plain',
          },
          body: fileContent,
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body).toHaveProperty('success', true)
        expect(body).toHaveProperty('key', fileKey)
        expect(body).toHaveProperty('publicUrl')

        // Verify file is stored in R2 bucket
        const stored = await r2.get(fileKey)
        expect(stored).not.toBeNull()
        if (stored) {
          const storedContent = await stored.text()
          expect(storedContent).toBe(fileContent)
        }
      })

      it('should return 200 on successful binary file upload', async () => {
        const account = await createAccount({ name: 'Storage Binary Upload Test' })
        const { headers } = await createUserWithRole(account.id, 'AUTHOR')
        const r2 = getR2()

        const fileKey = `test-${Date.now()}.bin`
        const binaryContent = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0xff])

        const res = await app.request(`/api/storage/upload/${encodeURIComponent(fileKey)}`, {
          method: 'PUT',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
            'Content-Type': 'application/octet-stream',
          },
          body: binaryContent,
        })

        expect(res.status).toBe(200)

        // Verify file is stored in R2 bucket
        const stored = await r2.get(fileKey)
        expect(stored).not.toBeNull()
        if (stored) {
          const storedBuffer = await stored.arrayBuffer()
          const storedContent = new Uint8Array(storedBuffer)
          expect(storedContent).toEqual(binaryContent)
        }
      })

      it('should handle URL-encoded file keys', async () => {
        const account = await createAccount({ name: 'Storage Encoded Key Test' })
        const { headers } = await createUserWithRole(account.id, 'AUTHOR')
        const r2 = getR2()

        const fileKey = `folder/subfolder/test-${Date.now()}.txt`
        const fileContent = 'Nested file content'

        const res = await app.request(`/api/storage/upload/${encodeURIComponent(fileKey)}`, {
          method: 'PUT',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
            'Content-Type': 'text/plain',
          },
          body: fileContent,
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.key).toBe(fileKey)

        // Verify file is stored with correct key
        const stored = await r2.get(fileKey)
        expect(stored).not.toBeNull()
      })

      it('should return correct public URL in response', async () => {
        const account = await createAccount({ name: 'Storage Public URL Test' })
        const { headers } = await createUserWithRole(account.id, 'AUTHOR')

        const fileKey = `test-${Date.now()}.txt`

        const res = await app.request(`/api/storage/upload/${encodeURIComponent(fileKey)}`, {
          method: 'PUT',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
            'Content-Type': 'text/plain',
          },
          body: 'test content',
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.publicUrl).toContain('r2-test.example.com')
        expect(body.publicUrl).toContain(fileKey)
      })
    })
  })

  // ============================================================================
  // DELETE /api/storage/{key} - Delete File
  // ============================================================================

  describe('DELETE /api/storage/{key}', () => {
    describe('Authentication (401)', () => {
      it('should return 401 without session cookie', async () => {
        const res = await app.request('/api/storage/test-key.txt', {
          method: 'DELETE',
        })

        expect(res.status).toBe(401)

        const body = await res.json()
        expect(body.error.message).toBe('Not authenticated')
      })
    })

    describe('Authorization (403)', () => {
      it('should return 403 if user lacks delete permission (VIEWER role)', async () => {
        const account = await createAccount({ name: 'Storage Viewer Delete Test' })
        const { headers } = await createUserWithRole(account.id, 'VIEWER')
        const r2 = getR2()

        // First, create a file to delete
        const fileKey = `delete-test-viewer-${Date.now()}.txt`
        await r2.put(fileKey, 'test content')

        const res = await app.request(`/api/storage/${encodeURIComponent(fileKey)}`, {
          method: 'DELETE',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
          },
        })

        expect(res.status).toBe(403)

        // Verify file still exists
        const stored = await r2.get(fileKey)
        expect(stored).not.toBeNull()
      })

      it('should return 403 if user lacks delete permission (AUTHOR role)', async () => {
        const account = await createAccount({ name: 'Storage Author Delete Test' })
        const { headers } = await createUserWithRole(account.id, 'AUTHOR')
        const r2 = getR2()

        // First, create a file to delete
        const fileKey = `delete-test-author-${Date.now()}.txt`
        await r2.put(fileKey, 'test content')

        const res = await app.request(`/api/storage/${encodeURIComponent(fileKey)}`, {
          method: 'DELETE',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
          },
        })

        expect(res.status).toBe(403)

        // Verify file still exists
        const stored = await r2.get(fileKey)
        expect(stored).not.toBeNull()
      })
    })

    describe('Not Found (404)', () => {
      it('should return 404 for non-existent file', async () => {
        const account = await createAccount({ name: 'Storage Not Found Test' })
        const { headers } = await createUserWithRole(account.id, 'EDITOR')

        const res = await app.request('/api/storage/non-existent-file.txt', {
          method: 'DELETE',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
          },
        })

        expect(res.status).toBe(404)

        const body = await res.json()
        expect(body.error.message).toContain('File')
      })
    })

    describe('Successful Delete (204)', () => {
      it('should return 204 on successful delete for EDITOR role', async () => {
        const account = await createAccount({ name: 'Storage Editor Delete Test' })
        const { headers } = await createUserWithRole(account.id, 'EDITOR')
        const r2 = getR2()

        // First, create a file to delete
        const fileKey = `delete-test-editor-${Date.now()}.txt`
        await r2.put(fileKey, 'test content')

        const res = await app.request(`/api/storage/${encodeURIComponent(fileKey)}`, {
          method: 'DELETE',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
          },
        })

        expect(res.status).toBe(204)

        // Verify file is removed from R2
        const stored = await r2.get(fileKey)
        expect(stored).toBeNull()
      })

      it('should return 204 on successful delete for MANAGER role', async () => {
        const account = await createAccount({ name: 'Storage Manager Delete Test' })
        const { headers } = await createUserWithRole(account.id, 'MANAGER')
        const r2 = getR2()

        // First, create a file to delete
        const fileKey = `delete-test-manager-${Date.now()}.txt`
        await r2.put(fileKey, 'test content')

        const res = await app.request(`/api/storage/${encodeURIComponent(fileKey)}`, {
          method: 'DELETE',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
          },
        })

        expect(res.status).toBe(204)

        // Verify file is removed from R2
        const stored = await r2.get(fileKey)
        expect(stored).toBeNull()
      })

      it('should return 204 on successful delete for ADMIN role', async () => {
        const account = await createAccount({ name: 'Storage Admin Delete Test' })
        const { headers } = await createUserWithRole(account.id, 'ADMIN')
        const r2 = getR2()

        // First, create a file to delete
        const fileKey = `delete-test-admin-${Date.now()}.txt`
        await r2.put(fileKey, 'test content')

        const res = await app.request(`/api/storage/${encodeURIComponent(fileKey)}`, {
          method: 'DELETE',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
          },
        })

        expect(res.status).toBe(204)

        // Verify file is removed from R2
        const stored = await r2.get(fileKey)
        expect(stored).toBeNull()
      })

      it('should handle URL-encoded file keys in delete', async () => {
        const account = await createAccount({ name: 'Storage Encoded Delete Test' })
        const { headers } = await createUserWithRole(account.id, 'EDITOR')
        const r2 = getR2()

        // First, create a file with nested path
        const fileKey = `folder/subfolder/delete-test-${Date.now()}.txt`
        await r2.put(fileKey, 'nested file content')

        const res = await app.request(`/api/storage/${encodeURIComponent(fileKey)}`, {
          method: 'DELETE',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
          },
        })

        expect(res.status).toBe(204)

        // Verify file is removed from R2
        const stored = await r2.get(fileKey)
        expect(stored).toBeNull()
      })
    })
  })

  // ============================================================================
  // END-TO-END WORKFLOW TESTS
  // ============================================================================

  describe('End-to-end workflow', () => {
    it('should complete full upload workflow: generate URL -> upload -> verify', async () => {
      const account = await createAccount({ name: 'Storage E2E Test' })
      const { headers } = await createUserWithRole(account.id, 'AUTHOR')
      const r2 = getR2()

      // Step 1: Generate upload URL
      const urlRes = await app.request('/api/storage/upload-url', {
        method: 'POST',
        headers: {
          ...headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: 'e2e-test.txt',
          contentType: 'text/plain',
        }),
      })

      expect(urlRes.status).toBe(200)
      const urlBody = await urlRes.json()

      // Step 2: Upload file using the generated URL
      const fileContent = 'End-to-end test content'
      const uploadRes = await app.request(urlBody.url, {
        method: 'PUT',
        headers: {
          ...headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
          'Content-Type': 'text/plain',
        },
        body: fileContent,
      })

      expect(uploadRes.status).toBe(200)
      const uploadBody = await uploadRes.json()
      expect(uploadBody.success).toBe(true)
      expect(uploadBody.key).toBe(urlBody.name)

      // Step 3: Verify file is stored
      const stored = await r2.get(urlBody.name)
      expect(stored).not.toBeNull()
      if (stored) {
        const storedContent = await stored.text()
        expect(storedContent).toBe(fileContent)
      }
    })

    it('should complete full lifecycle: upload -> verify -> delete -> verify deleted', async () => {
      const account = await createAccount({ name: 'Storage Lifecycle Test' })
      const { headers } = await createUserWithRole(account.id, 'EDITOR') // EDITOR can both upload and delete
      const r2 = getR2()

      const fileKey = `lifecycle-test-${Date.now()}.txt`
      const fileContent = 'Lifecycle test content'

      // Step 1: Upload file
      const uploadRes = await app.request(`/api/storage/upload/${encodeURIComponent(fileKey)}`, {
        method: 'PUT',
        headers: {
          ...headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
          'Content-Type': 'text/plain',
        },
        body: fileContent,
      })

      expect(uploadRes.status).toBe(200)

      // Step 2: Verify file exists
      let stored = await r2.get(fileKey)
      expect(stored).not.toBeNull()

      // Step 3: Delete file
      const deleteRes = await app.request(`/api/storage/${encodeURIComponent(fileKey)}`, {
        method: 'DELETE',
        headers: {
          ...headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
        },
      })

      expect(deleteRes.status).toBe(204)

      // Step 4: Verify file is deleted
      stored = await r2.get(fileKey)
      expect(stored).toBeNull()
    })
  })

  // ============================================================================
  // ROLE PERMISSION MATRIX TESTS
  // ============================================================================

  describe('Role permission matrix for storage', () => {
    const storagePermissionTests: {
      role: Role
      operation: string
      endpoint: string
      method: 'POST' | 'PUT' | 'DELETE'
      shouldSucceed: boolean
      body?: string | Record<string, unknown>
      contentType?: string
    }[] = [
      // ADMIN - full access
      { role: 'ADMIN', operation: 'Generate upload URL', endpoint: '/api/storage/upload-url', method: 'POST', shouldSucceed: true, body: { filename: 'test.txt', contentType: 'text/plain' }, contentType: 'application/json' },

      // MANAGER - full access
      { role: 'MANAGER', operation: 'Generate upload URL', endpoint: '/api/storage/upload-url', method: 'POST', shouldSucceed: true, body: { filename: 'test.txt', contentType: 'text/plain' }, contentType: 'application/json' },

      // EDITOR - full access
      { role: 'EDITOR', operation: 'Generate upload URL', endpoint: '/api/storage/upload-url', method: 'POST', shouldSucceed: true, body: { filename: 'test.txt', contentType: 'text/plain' }, contentType: 'application/json' },

      // AUTHOR - can upload, cannot delete
      { role: 'AUTHOR', operation: 'Generate upload URL', endpoint: '/api/storage/upload-url', method: 'POST', shouldSucceed: true, body: { filename: 'test.txt', contentType: 'text/plain' }, contentType: 'application/json' },

      // VIEWER - no storage access
      { role: 'VIEWER', operation: 'Generate upload URL', endpoint: '/api/storage/upload-url', method: 'POST', shouldSucceed: false, body: { filename: 'test.txt', contentType: 'text/plain' }, contentType: 'application/json' },

      // BILLING - no storage access
      { role: 'BILLING', operation: 'Generate upload URL', endpoint: '/api/storage/upload-url', method: 'POST', shouldSucceed: false, body: { filename: 'test.txt', contentType: 'text/plain' }, contentType: 'application/json' },

      // ANALYTICS - no storage access
      { role: 'ANALYTICS', operation: 'Generate upload URL', endpoint: '/api/storage/upload-url', method: 'POST', shouldSucceed: false, body: { filename: 'test.txt', contentType: 'text/plain' }, contentType: 'application/json' },
    ]

    for (const testCase of storagePermissionTests) {
      it(`${testCase.role} ${testCase.shouldSucceed ? 'CAN' : 'CANNOT'} ${testCase.operation}`, async () => {
        const account = await createAccount({ name: `Storage Matrix ${testCase.role} ${testCase.operation}` })
        const { headers } = await createUserWithRole(account.id, testCase.role)

        const requestInit: RequestInit = {
          method: testCase.method,
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
          },
        }

        if (testCase.body) {
          requestInit.headers = {
            ...requestInit.headers,
            'Content-Type': testCase.contentType || 'application/json',
          }
          requestInit.body = typeof testCase.body === 'string' ? testCase.body : JSON.stringify(testCase.body)
        }

        const res = await app.request(testCase.endpoint, requestInit)

        if (testCase.shouldSucceed) {
          expect(res.status).toBe(200)
        } else {
          expect(res.status).toBe(403)
        }
      })
    }

    // Delete permission tests (need to create files first)
    const deletePermissionTests: {
      role: Role
      shouldSucceed: boolean
    }[] = [
      { role: 'ADMIN', shouldSucceed: true },
      { role: 'MANAGER', shouldSucceed: true },
      { role: 'EDITOR', shouldSucceed: true },
      { role: 'AUTHOR', shouldSucceed: false },
      { role: 'VIEWER', shouldSucceed: false },
      { role: 'BILLING', shouldSucceed: false },
      { role: 'ANALYTICS', shouldSucceed: false },
    ]

    for (const testCase of deletePermissionTests) {
      it(`${testCase.role} ${testCase.shouldSucceed ? 'CAN' : 'CANNOT'} delete files`, async () => {
        const account = await createAccount({ name: `Storage Delete Matrix ${testCase.role}` })
        const { headers } = await createUserWithRole(account.id, testCase.role)
        const r2 = getR2()

        // Create a file to delete
        const fileKey = `delete-matrix-${testCase.role}-${Date.now()}.txt`
        await r2.put(fileKey, 'test content')

        const res = await app.request(`/api/storage/${encodeURIComponent(fileKey)}`, {
          method: 'DELETE',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
          },
        })

        if (testCase.shouldSucceed) {
          expect(res.status).toBe(204)
          // Verify file is deleted
          const stored = await r2.get(fileKey)
          expect(stored).toBeNull()
        } else {
          expect(res.status).toBe(403)
          // Verify file still exists
          const stored = await r2.get(fileKey)
          expect(stored).not.toBeNull()
        }
      })
    }
  })

  // ============================================================================
  // CONTENT TYPE TESTS
  // ============================================================================

  describe('Content type handling', () => {
    it('should handle image upload (image/jpeg)', async () => {
      const account = await createAccount({ name: 'Storage Image Upload Test' })
      const { headers } = await createUserWithRole(account.id, 'AUTHOR')
      const r2 = getR2()

      const fileKey = `image-test-${Date.now()}.jpg`
      // Create a minimal JPEG-like binary content
      const binaryContent = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])

      const res = await app.request(`/api/storage/upload/${encodeURIComponent(fileKey)}`, {
        method: 'PUT',
        headers: {
          ...headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
          'Content-Type': 'image/jpeg',
        },
        body: binaryContent,
      })

      expect(res.status).toBe(200)

      const stored = await r2.get(fileKey)
      expect(stored).not.toBeNull()
    })

    it('should handle JSON upload (application/json)', async () => {
      const account = await createAccount({ name: 'Storage JSON Upload Test' })
      const { headers } = await createUserWithRole(account.id, 'AUTHOR')
      const r2 = getR2()

      const fileKey = `data-test-${Date.now()}.json`
      const jsonContent = JSON.stringify({ test: 'data', number: 123 })

      const res = await app.request(`/api/storage/upload/${encodeURIComponent(fileKey)}`, {
        method: 'PUT',
        headers: {
          ...headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
          'Content-Type': 'application/json',
        },
        body: jsonContent,
      })

      expect(res.status).toBe(200)

      const stored = await r2.get(fileKey)
      expect(stored).not.toBeNull()
      if (stored) {
        const storedContent = await stored.text()
        expect(storedContent).toBe(jsonContent)
      }
    })

    it('should handle PDF upload (application/pdf)', async () => {
      const account = await createAccount({ name: 'Storage PDF Upload Test' })
      const { headers } = await createUserWithRole(account.id, 'AUTHOR')
      const r2 = getR2()

      const fileKey = `document-test-${Date.now()}.pdf`
      // Create minimal PDF-like binary content
      const pdfContent = new TextEncoder().encode('%PDF-1.4 mock content')

      const res = await app.request(`/api/storage/upload/${encodeURIComponent(fileKey)}`, {
        method: 'PUT',
        headers: {
          ...headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
          'Content-Type': 'application/pdf',
        },
        body: pdfContent,
      })

      expect(res.status).toBe(200)

      const stored = await r2.get(fileKey)
      expect(stored).not.toBeNull()
    })
  })
})
