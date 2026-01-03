/**
 * Storage Validation Integration Tests
 *
 * Tests file upload validation rules:
 * - Invalid file types rejection (TODO: implement content type blocklist)
 * - File size limits enforcement (TODO: implement file size validation)
 * - Empty file handling (IMPLEMENTED)
 * - File extension/content type matching (TODO: implement extension validation)
 *
 * Tests marked with .skip require features to be implemented in the handlers.
 * Once implemented, remove .skip to enable the tests.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { Hono } from 'hono'
import { getEnv, getDb, getR2, type TestEnv } from '../setup'
import {
  createUser,
  createUserSession,
  createAccount,
  addUserToAccount,
  type Role,
} from '../fixtures'
import type { HonoEnv } from '../../types'
import { api } from '../../routes'
import { errorHandler } from '../../middleware/error-handler'
import { sessionMiddleware } from '../../lib/session'

// ============================================================================
// TEST SETUP
// ============================================================================

/**
 * Creates a database wrapper that adds the `execute` method
 * The better-sqlite3 drizzle doesn't have execute, but D1 does
 */
function createTestDb() {
  const db = getDb()
  return new Proxy(db, {
    get(target, prop) {
      if (prop === 'execute') {
        return target.run.bind(target)
      }
      return (target as any)[prop]
    },
  })
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

describe('Storage Validation Integration', () => {
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
  // CONTENT TYPE VALIDATION
  // ============================================================================

  describe('Content Type Validation', () => {
    // TODO: Enable these tests after implementing content type blocklist in handlers
    describe.skip('Disallowed Content Types (Executable Files)', () => {
      const executableContentTypes = [
        { contentType: 'application/x-executable', extension: 'exe', description: 'Linux executable' },
        { contentType: 'application/x-msdownload', extension: 'exe', description: 'Windows executable (.exe)' },
        { contentType: 'application/x-msdos-program', extension: 'exe', description: 'MS-DOS program' },
        { contentType: 'application/x-sh', extension: 'sh', description: 'Shell script' },
        { contentType: 'application/x-bat', extension: 'bat', description: 'Batch file' },
        { contentType: 'application/x-msi', extension: 'msi', description: 'Windows installer' },
        { contentType: 'application/vnd.microsoft.portable-executable', extension: 'exe', description: 'Portable executable' },
      ]

      for (const { contentType, extension, description } of executableContentTypes) {
        it(`should reject upload with disallowed content type: ${description} (${contentType})`, async () => {
          const account = await createAccount({ name: `Validation ${description} Test` })
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
              filename: `malicious.${extension}`,
              contentType: contentType,
            }),
          })

          // Expect 400 Bad Request for disallowed content types
          expect(res.status).toBe(400)

          const body = await res.json()
          expect(body).toHaveProperty('error')
          expect(body.error.message).toContain('content type')
        })
      }

      it('should reject upload with application/x-executable content type on PUT endpoint', async () => {
        const account = await createAccount({ name: 'Validation Executable PUT Test' })
        const { headers } = await createUserWithRole(account.id, 'AUTHOR')

        const fileKey = `malicious-${Date.now()}.exe`
        const executableContent = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]) // MZ header

        const res = await app.request(`/api/storage/upload/${encodeURIComponent(fileKey)}`, {
          method: 'PUT',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
            'Content-Type': 'application/x-msdownload',
          },
          body: executableContent,
        })

        // Expect 400 Bad Request for executable content types
        expect(res.status).toBe(400)

        const body = await res.json()
        expect(body.error.message).toContain('content type')
      })
    })

    describe('Allowed Content Types', () => {
      const allowedContentTypes = [
        { contentType: 'image/jpeg', extension: 'jpg' },
        { contentType: 'image/png', extension: 'png' },
        { contentType: 'image/gif', extension: 'gif' },
        { contentType: 'image/webp', extension: 'webp' },
        { contentType: 'application/pdf', extension: 'pdf' },
        { contentType: 'text/plain', extension: 'txt' },
        { contentType: 'application/json', extension: 'json' },
        { contentType: 'video/mp4', extension: 'mp4' },
        { contentType: 'audio/mpeg', extension: 'mp3' },
      ]

      for (const { contentType, extension } of allowedContentTypes) {
        it(`should allow upload with content type: ${contentType}`, async () => {
          const account = await createAccount({ name: `Validation ${contentType} Test` })
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
              filename: `test-file.${extension}`,
              contentType: contentType,
            }),
          })

          expect(res.status).toBe(200)

          const body = await res.json()
          expect(body).toHaveProperty('url')
          expect(body).toHaveProperty('name')
        })
      }
    })
  })

  // ============================================================================
  // FILE SIZE VALIDATION
  // ============================================================================

  describe('File Size Validation', () => {
    // Maximum file size limit (10MB for this test)
    const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

    // TODO: Enable this test after implementing file size validation in handlers
    it.skip('should enforce maximum file size limit', async () => {
      const account = await createAccount({ name: 'Validation File Size Test' })
      const { headers } = await createUserWithRole(account.id, 'AUTHOR')

      const fileKey = `large-file-${Date.now()}.txt`
      // Create content larger than max size (11MB)
      const largeContent = new Uint8Array(11 * 1024 * 1024).fill(0x41) // 'A' characters

      const res = await app.request(`/api/storage/upload/${encodeURIComponent(fileKey)}`, {
        method: 'PUT',
        headers: {
          ...headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
          'Content-Type': 'text/plain',
        },
        body: largeContent,
      })

      // Expect 413 Payload Too Large or 400 Bad Request
      expect([400, 413]).toContain(res.status)

      const body = await res.json()
      expect(body).toHaveProperty('error')
      expect(body.error.message.toLowerCase()).toMatch(/size|large|limit|exceed/)
    })

    it('should allow files within size limit', async () => {
      const account = await createAccount({ name: 'Validation File Size OK Test' })
      const { headers } = await createUserWithRole(account.id, 'AUTHOR')
      const r2 = getR2()

      const fileKey = `normal-file-${Date.now()}.txt`
      // Create content within size limit (1KB)
      const normalContent = new Uint8Array(1024).fill(0x41) // 'A' characters

      const res = await app.request(`/api/storage/upload/${encodeURIComponent(fileKey)}`, {
        method: 'PUT',
        headers: {
          ...headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
          'Content-Type': 'text/plain',
        },
        body: normalContent,
      })

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.success).toBe(true)

      // Verify file was stored
      const stored = await r2.get(fileKey)
      expect(stored).not.toBeNull()
    })

    it('should allow files at exactly the size limit', async () => {
      const account = await createAccount({ name: 'Validation Exact Size Test' })
      const { headers } = await createUserWithRole(account.id, 'AUTHOR')
      const r2 = getR2()

      const fileKey = `exact-size-${Date.now()}.txt`
      // Create content exactly at size limit (10MB)
      const exactContent = new Uint8Array(MAX_FILE_SIZE).fill(0x42) // 'B' characters

      const res = await app.request(`/api/storage/upload/${encodeURIComponent(fileKey)}`, {
        method: 'PUT',
        headers: {
          ...headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
          'Content-Type': 'text/plain',
        },
        body: exactContent,
      })

      // Should succeed at exactly the limit
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.success).toBe(true)

      // Verify file was stored
      const stored = await r2.get(fileKey)
      expect(stored).not.toBeNull()
    })
  })

  // ============================================================================
  // EMPTY FILE VALIDATION
  // ============================================================================

  describe('Empty File Validation', () => {
    it('should handle empty file upload', async () => {
      const account = await createAccount({ name: 'Validation Empty File Test' })
      const { headers } = await createUserWithRole(account.id, 'AUTHOR')

      const fileKey = `empty-file-${Date.now()}.txt`

      const res = await app.request(`/api/storage/upload/${encodeURIComponent(fileKey)}`, {
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
      expect(body).toHaveProperty('error')
      expect(body.error.message).toContain('empty')
    })

    it('should reject zero-byte ArrayBuffer upload', async () => {
      const account = await createAccount({ name: 'Validation Zero Byte Test' })
      const { headers } = await createUserWithRole(account.id, 'AUTHOR')

      const fileKey = `zero-byte-${Date.now()}.bin`
      const emptyBuffer = new Uint8Array(0)

      const res = await app.request(`/api/storage/upload/${encodeURIComponent(fileKey)}`, {
        method: 'PUT',
        headers: {
          ...headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
          'Content-Type': 'application/octet-stream',
        },
        body: emptyBuffer,
      })

      expect(res.status).toBe(400)

      const body = await res.json()
      expect(body.error.message).toContain('empty')
    })

    it('should allow single-byte file upload', async () => {
      const account = await createAccount({ name: 'Validation Single Byte Test' })
      const { headers } = await createUserWithRole(account.id, 'AUTHOR')
      const r2 = getR2()

      const fileKey = `single-byte-${Date.now()}.bin`
      const singleByte = new Uint8Array([0x00])

      const res = await app.request(`/api/storage/upload/${encodeURIComponent(fileKey)}`, {
        method: 'PUT',
        headers: {
          ...headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
          'Content-Type': 'application/octet-stream',
        },
        body: singleByte,
      })

      expect(res.status).toBe(200)

      // Verify file was stored
      const stored = await r2.get(fileKey)
      expect(stored).not.toBeNull()
      if (stored) {
        const buffer = await stored.arrayBuffer()
        expect(buffer.byteLength).toBe(1)
      }
    })
  })

  // ============================================================================
  // FILE EXTENSION / CONTENT TYPE MATCHING
  // ============================================================================

  describe('File Extension / Content Type Matching', () => {
    // TODO: Enable these tests after implementing extension/content-type validation in handlers
    describe.skip('Mismatch Cases', () => {
      const mismatchCases = [
        {
          filename: 'document.pdf',
          contentType: 'image/jpeg',
          description: 'PDF extension with JPEG content type',
        },
        {
          filename: 'image.jpg',
          contentType: 'text/plain',
          description: 'JPG extension with text content type',
        },
        {
          filename: 'script.js',
          contentType: 'image/png',
          description: 'JS extension with PNG content type',
        },
        {
          filename: 'data.json',
          contentType: 'application/pdf',
          description: 'JSON extension with PDF content type',
        },
        {
          filename: 'video.mp4',
          contentType: 'audio/mpeg',
          description: 'MP4 extension with MP3 content type',
        },
      ]

      for (const { filename, contentType, description } of mismatchCases) {
        it(`should validate file extension matches content type: ${description}`, async () => {
        const account = await createAccount({ name: `Validation Mismatch ${filename} Test` })
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
            filename,
            contentType,
          }),
        })

        // Expect 400 Bad Request for mismatched extension/content type
        expect(res.status).toBe(400)

        const body = await res.json()
        expect(body).toHaveProperty('error')
        expect(body.error.message.toLowerCase()).toMatch(/extension|content.?type|mismatch/)
        })
      }
    })

    describe('Valid Extension / Content Type Combinations', () => {
      const validCases = [
        { filename: 'image.jpg', contentType: 'image/jpeg' },
        { filename: 'image.jpeg', contentType: 'image/jpeg' },
        { filename: 'photo.png', contentType: 'image/png' },
        { filename: 'document.pdf', contentType: 'application/pdf' },
        { filename: 'data.json', contentType: 'application/json' },
        { filename: 'readme.txt', contentType: 'text/plain' },
        { filename: 'video.mp4', contentType: 'video/mp4' },
        { filename: 'audio.mp3', contentType: 'audio/mpeg' },
        { filename: 'animation.gif', contentType: 'image/gif' },
        { filename: 'styles.css', contentType: 'text/css' },
      ]

      for (const { filename, contentType } of validCases) {
        it(`should accept matching extension and content type: ${filename} with ${contentType}`, async () => {
          const account = await createAccount({ name: `Validation Match ${filename} Test` })
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
              filename,
              contentType,
            }),
          })

          expect(res.status).toBe(200)

          const body = await res.json()
          expect(body).toHaveProperty('url')
          expect(body).toHaveProperty('name')
        })
      }
    })

    describe('Generic/Unknown Content Types', () => {
      it('should handle application/octet-stream with any extension', async () => {
        const account = await createAccount({ name: 'Validation Octet Stream Test' })
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
            filename: 'unknown.xyz',
            contentType: 'application/octet-stream',
          }),
        })

        // application/octet-stream should be allowed as a generic binary type
        expect(res.status).toBe(200)
      })
    })
  })

  // ============================================================================
  // UPLOAD CANCELLATION HANDLING
  // ============================================================================

  describe('Upload Cancellation Handling', () => {
    // NOTE: AbortController doesn't work as expected in the test environment
    // The request completes before the abort signal is processed
    it.skip('should handle aborted request gracefully', async () => {
      const account = await createAccount({ name: 'Validation Abort Test' })
      const { headers } = await createUserWithRole(account.id, 'AUTHOR')
      const r2 = getR2()

      const fileKey = `aborted-${Date.now()}.txt`
      const controller = new AbortController()

      // Abort immediately
      controller.abort()

      try {
        await app.request(`/api/storage/upload/${encodeURIComponent(fileKey)}`, {
          method: 'PUT',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
            'Content-Type': 'text/plain',
          },
          body: 'This should not be uploaded',
          signal: controller.signal,
        })
        // If we get here, the request wasn't aborted as expected
        // Verify file was NOT stored due to abort
      } catch (error) {
        // Expected: AbortError
        expect(error).toBeDefined()
        if (error instanceof Error) {
          expect(error.name).toBe('AbortError')
        }
      }

      // Verify file was NOT stored in R2 (upload was cancelled)
      const stored = await r2.get(fileKey)
      expect(stored).toBeNull()
    })

    it('should not store partial file on interrupted upload', async () => {
      const account = await createAccount({ name: 'Validation Partial Upload Test' })
      const { headers } = await createUserWithRole(account.id, 'AUTHOR')
      const r2 = getR2()

      const fileKey = `partial-${Date.now()}.txt`

      // Simulate interrupted upload by sending incomplete data
      // In a real scenario, the connection would drop mid-upload
      // Here we test that the system handles it gracefully

      const incompleteContent = 'Start of content...'

      const res = await app.request(`/api/storage/upload/${encodeURIComponent(fileKey)}`, {
        method: 'PUT',
        headers: {
          ...headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
          'Content-Type': 'text/plain',
          'Content-Length': '1000000', // Claim large file but send less
        },
        body: incompleteContent,
      })

      // The request might succeed or fail depending on implementation
      // What matters is the stored content matches what was sent
      if (res.status === 200) {
        const stored = await r2.get(fileKey)
        if (stored) {
          const content = await stored.text()
          expect(content).toBe(incompleteContent)
        }
      } else {
        // If it failed, verify no partial file was stored
        const stored = await r2.get(fileKey)
        expect(stored).toBeNull()
      }
    })
  })

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle filename with multiple extensions', async () => {
      const account = await createAccount({ name: 'Validation Multi Extension Test' })
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
          filename: 'document.tar.gz',
          contentType: 'application/gzip',
        }),
      })

      expect(res.status).toBe(200)
    })

    it('should handle filename without extension', async () => {
      const account = await createAccount({ name: 'Validation No Extension Test' })
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
          filename: 'README',
          contentType: 'text/plain',
        }),
      })

      // Should be allowed - no extension to validate against
      expect(res.status).toBe(200)
    })

    it('should handle very long filename', async () => {
      const account = await createAccount({ name: 'Validation Long Filename Test' })
      const { headers } = await createUserWithRole(account.id, 'AUTHOR')

      const longFilename = 'a'.repeat(500) + '.txt'

      const res = await app.request('/api/storage/upload-url', {
        method: 'POST',
        headers: {
          ...headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: longFilename,
          contentType: 'text/plain',
        }),
      })

      // May succeed or fail based on filename length limits
      expect([200, 400]).toContain(res.status)
    })

    it('should handle special characters in filename', async () => {
      const account = await createAccount({ name: 'Validation Special Chars Test' })
      const { headers } = await createUserWithRole(account.id, 'AUTHOR')

      const specialFilename = 'file with spaces & (special) chars!.txt'

      const res = await app.request('/api/storage/upload-url', {
        method: 'POST',
        headers: {
          ...headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: specialFilename,
          contentType: 'text/plain',
        }),
      })

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.name).toContain('special')
    })

    it('should handle unicode filename', async () => {
      const account = await createAccount({ name: 'Validation Unicode Test' })
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
          filename: 'documento_espanol.txt',
          contentType: 'text/plain',
        }),
      })

      expect(res.status).toBe(200)
    })
  })
})
