import { test, expect, isAuthenticated, apiRequest, getAccountId, closeAllDialogs } from '../fixtures'

/**
 * File Upload Management Journey Tests
 *
 * These tests verify complete file management flows,
 * including requesting upload URLs, validating file operations,
 * and handling storage errors gracefully.
 *
 * Note: Some tests may skip if R2 storage is not configured.
 *
 * @tags @journey @storage @files
 */

test.describe('File Upload Management Journey @journey @storage', () => {
  test.describe('Upload URL Request Flow', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')

      const accountId = getAccountId()
      test.skip(!accountId, 'No account ID available')
    })

    test.afterEach(async ({ page }) => {
      await closeAllDialogs(page)
    })

    test('should request upload URL for image file', async ({ page }) => {
      // Step 1: Request upload URL for a JPEG image
      const response = await apiRequest(page, 'post', '/api/storage/upload-url', {
        data: {
          filename: 'test-image.jpg',
          contentType: 'image/jpeg',
        },
      })

      // Step 2: Handle both configured and unconfigured R2 states
      expect([200, 400]).toContain(response.status())

      const body = await response.json()

      if (response.status() === 200) {
        // Step 3: Verify successful response structure
        expect(body).toHaveProperty('url')
        expect(body).toHaveProperty('name')
        expect(body).toHaveProperty('publicUrl')

        // Step 4: Verify URL format
        expect(body.url).toContain('/api/storage/upload/')
        expect(typeof body.publicUrl).toBe('string')
      } else {
        // R2 not configured - verify error structure
        expect(body).toHaveProperty('error')
      }
    })

    test('should request upload URL for PNG file', async ({ page }) => {
      // Step 1: Request upload URL for a PNG image
      const response = await apiRequest(page, 'post', '/api/storage/upload-url', {
        data: {
          filename: 'avatar.png',
          contentType: 'image/png',
        },
      })

      // Step 2: Handle both configured and unconfigured states
      expect([200, 400]).toContain(response.status())

      const body = await response.json()

      if (response.status() === 200) {
        expect(body).toHaveProperty('url')
        expect(body.name).toContain('.png')
      }
    })

    test('should request upload URL for PDF document', async ({ page }) => {
      // Step 1: Request upload URL for a PDF document
      const response = await apiRequest(page, 'post', '/api/storage/upload-url', {
        data: {
          filename: 'document.pdf',
          contentType: 'application/pdf',
        },
      })

      expect([200, 400]).toContain(response.status())

      const body = await response.json()

      if (response.status() === 200) {
        expect(body).toHaveProperty('url')
        expect(body.name).toContain('.pdf')
      }
    })
  })

  test.describe('File Validation Flow', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')

      const accountId = getAccountId()
      test.skip(!accountId, 'No account ID available')
    })

    test('should reject upload request with missing filename', async ({ page }) => {
      // Step 1: Request with missing filename
      const response = await apiRequest(page, 'post', '/api/storage/upload-url', {
        data: {
          contentType: 'image/jpeg',
        },
      })

      // Step 2: Should return validation error
      expect(response.status()).toBe(400)

      const body = await response.json()
      expect(body).toHaveProperty('error')
    })

    test('should reject upload request with missing content type', async ({ page }) => {
      // Step 1: Request with missing content type
      const response = await apiRequest(page, 'post', '/api/storage/upload-url', {
        data: {
          filename: 'test.jpg',
        },
      })

      // Step 2: Should return validation error
      expect(response.status()).toBe(400)

      const body = await response.json()
      expect(body).toHaveProperty('error')
    })

    test('should reject upload request with empty body', async ({ page }) => {
      // Step 1: Request with empty body
      const response = await apiRequest(page, 'post', '/api/storage/upload-url', {
        data: {},
      })

      // Step 2: Should return validation error
      expect(response.status()).toBe(400)

      const body = await response.json()
      expect(body).toHaveProperty('error')
    })
  })

  test.describe('File Deletion Flow', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')

      const accountId = getAccountId()
      test.skip(!accountId, 'No account ID available')
    })

    test('should return 404 for non-existent file deletion', async ({ page }) => {
      // Step 1: Attempt to delete a non-existent file
      const nonExistentKey = encodeURIComponent('test/non-existent-file-12345.jpg')
      const response = await apiRequest(page, 'delete', `/api/storage/${nonExistentKey}`)

      // Step 2: Should return 404 (not found) or 400 (R2 not configured)
      expect([404, 400]).toContain(response.status())

      const body = await response.json()
      expect(body).toHaveProperty('error')
      expect(body.error).toHaveProperty('message')
    })

    test('should handle deletion of randomly named files gracefully', async ({ page }) => {
      // Step 1: Generate random file keys to test deletion
      const randomKeys = [
        `temp/file-${Date.now()}.jpg`,
        `uploads/image-${Math.random().toString(36).substring(7)}.png`,
        `avatars/user-${Date.now()}.webp`,
      ]

      for (const key of randomKeys) {
        const encodedKey = encodeURIComponent(key)
        const response = await apiRequest(page, 'delete', `/api/storage/${encodedKey}`)

        // Step 2: All should return not found or R2 error
        expect([404, 400]).toContain(response.status())

        const body = await response.json()
        expect(body).toHaveProperty('error')
      }
    })
  })

  test.describe('File Upload Error Handling', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')

      const accountId = getAccountId()
      test.skip(!accountId, 'No account ID available')
    })

    test('should return error for upload with empty body', async ({ page }) => {
      // Step 1: Attempt upload with empty body
      const testKey = encodeURIComponent('test/empty-upload.txt')
      const response = await apiRequest(page, 'put', `/api/storage/upload/${testKey}`, {
        headers: {
          'content-type': 'text/plain',
        },
      })

      // Step 2: Should return 400 error
      expect(response.status()).toBe(400)

      const body = await response.json()
      expect(body).toHaveProperty('error')
      expect(body.error).toHaveProperty('message')
    })
  })

  test.describe('Profile Picture Upload Journey', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test.afterEach(async ({ page }) => {
      await closeAllDialogs(page)
    })

    test('should display profile picture section in settings', async ({ page }) => {
      // Step 1: Navigate to settings page
      await page.goto('/settings')
      await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible()

      // Step 2: Verify Profile Picture section exists
      await expect(page.getByRole('heading', { name: 'Profile Picture' })).toBeVisible()

      // Step 3: Verify Change Photo button is present
      const changePhotoButton = page.getByRole('button', { name: /change photo/i })
      await expect(changePhotoButton).toBeVisible()
      await expect(changePhotoButton).toBeEnabled()

      // Step 4: Verify file size limit hint
      await expect(page.getByText(/max 2mb/i)).toBeVisible()
    })

    test('should have file input for profile picture upload', async ({ page }) => {
      // Step 1: Navigate to settings page
      await page.goto('/settings')

      // Step 2: Verify hidden file input exists
      const fileInput = page.locator('input[type="file"]')
      await expect(fileInput).toHaveCount(1)

      // Step 3: Verify file input accepts images
      const acceptAttr = await fileInput.getAttribute('accept')
      expect(acceptAttr).toContain('image/')
    })
  })

  test.describe('Complete File Management Workflow', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')

      const accountId = getAccountId()
      test.skip(!accountId, 'No account ID available')
    })

    test('complete file management workflow via API', async ({ page }) => {
      // Step 1: Request upload URL
      const uploadUrlResponse = await apiRequest(page, 'post', '/api/storage/upload-url', {
        data: {
          filename: `workflow-test-${Date.now()}.jpg`,
          contentType: 'image/jpeg',
        },
      })

      // Step 2: Handle R2 configuration state
      if (uploadUrlResponse.status() === 400) {
        // R2 not configured - test passes with graceful handling
        const body = await uploadUrlResponse.json()
        expect(body).toHaveProperty('error')
        return
      }

      expect(uploadUrlResponse.status()).toBe(200)
      const uploadData = await uploadUrlResponse.json()

      // Step 3: Verify upload URL structure
      expect(uploadData).toHaveProperty('url')
      expect(uploadData).toHaveProperty('name')
      expect(uploadData).toHaveProperty('publicUrl')

      // Step 4: Verify the file key format
      expect(uploadData.name).toMatch(/^[a-zA-Z0-9-_/.]+$/)

      // Step 5: Try to delete the file (cleanup)
      const encodedKey = encodeURIComponent(uploadData.name)
      const deleteResponse = await apiRequest(page, 'delete', `/api/storage/${encodedKey}`)

      // Should return 404 (file not actually uploaded) or success
      expect([200, 404, 400]).toContain(deleteResponse.status())
    })
  })
})
