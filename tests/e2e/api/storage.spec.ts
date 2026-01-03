import { test, expect, isAuthenticated, apiRequest, getAccountId } from '../fixtures'

/**
 * Storage API E2E Tests
 *
 * Tests for the storage API endpoints (R2-based file storage).
 * Uses apiRequest helper to make API calls with session cookie and account-id header.
 *
 * Note: Some tests may return validation errors if R2 storage is not configured
 * in the test environment. This is expected behavior.
 *
 * @tags @api @storage
 */

test.describe('Storage API @api @storage', () => {
  test.beforeEach(async ({ page }) => {
    const authenticated = await isAuthenticated(page)
    test.skip(!authenticated, 'No authenticated session available')

    const accountId = getAccountId()
    test.skip(!accountId, 'No account ID available')
  })

  test.describe('Generate Upload URL', () => {
    test('POST /api/storage/upload-url should generate upload URL or return validation error', async ({
      page,
    }) => {
      const response = await apiRequest(page, 'post', '/api/storage/upload-url', {
        data: {
          filename: 'test-image.jpg',
          contentType: 'image/jpeg',
        },
      })

      // Either 200 (R2 configured) or 400 (R2 not configured - validation error)
      expect([200, 400]).toContain(response.status())

      const body = await response.json()

      if (response.status() === 200) {
        // Success response should have upload URL structure
        expect(body).toHaveProperty('url')
        expect(body).toHaveProperty('name')
        expect(body).toHaveProperty('publicUrl')

        // Validate types
        expect(typeof body.url).toBe('string')
        expect(typeof body.name).toBe('string')
        expect(typeof body.publicUrl).toBe('string')

        // URL should be the upload endpoint path
        expect(body.url).toContain('/api/storage/upload/')
      } else {
        // Validation error (R2 not configured)
        expect(body).toHaveProperty('error')
        expect(body.error).toHaveProperty('message')
      }
    })

    test('POST /api/storage/upload-url with invalid data should return 400', async ({ page }) => {
      // Missing required fields
      const response = await apiRequest(page, 'post', '/api/storage/upload-url', {
        data: {},
      })

      expect(response.status()).toBe(400)

      const body = await response.json()
      expect(body).toHaveProperty('error')
    })
  })

  test.describe('File Operations', () => {
    test('DELETE /api/storage/:key should return 404 for non-existent file', async ({ page }) => {
      const nonExistentKey = encodeURIComponent('non-existent/file-12345.jpg')

      const response = await apiRequest(page, 'delete', `/api/storage/${nonExistentKey}`)

      // Either 404 (file not found) or 400 (R2 not configured)
      expect([404, 400]).toContain(response.status())

      const body = await response.json()
      expect(body).toHaveProperty('error')
      expect(body.error).toHaveProperty('message')

      if (response.status() === 404) {
        // File not found error
        expect(body.error.message).toContain('not found')
      }
    })

    test('PUT /api/storage/upload/:key should return error for empty body', async ({ page }) => {
      const testKey = encodeURIComponent('test/empty-file.txt')

      const response = await apiRequest(page, 'put', `/api/storage/upload/${testKey}`, {
        headers: {
          'content-type': 'text/plain',
        },
      })

      // Either 400 (empty body or R2 not configured)
      expect(response.status()).toBe(400)

      const body = await response.json()
      expect(body).toHaveProperty('error')
      expect(body.error).toHaveProperty('message')
    })
  })
})
