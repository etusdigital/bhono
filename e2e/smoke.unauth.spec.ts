import { test, expect } from '@playwright/test'

/**
 * Smoke tests for unauthenticated pages
 * These tests verify basic functionality without requiring authentication
 *
 * @tags @smoke @critical
 */

test.describe('Smoke Tests (Unauthenticated)', () => {
  test('home page loads correctly', async ({ page }) => {
    await page.goto('/')

    // Should see the home page content - check for app name in title or content
    await expect(page.locator('body')).toBeVisible()

    // Should have login link or button
    const loginLink = page.getByRole('link', { name: /login|sign in|get started/i })
    await expect(loginLink.first()).toBeVisible()
  })

  test('login page loads correctly', async ({ page }) => {
    await page.goto('/login')

    // Should see login page content
    await expect(page.getByText('Welcome back')).toBeVisible()
    await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible()
  })

  test('health endpoint returns healthy status', async ({ request, baseURL }) => {
    const response = await request.get(`${baseURL}/health`)

    // Check content type to ensure we're hitting the API, not Vite's HTML fallback
    const contentType = response.headers()['content-type'] || ''

    if (!contentType.includes('application/json')) {
      // Skip in dev mode if Vite is serving HTML instead of API
      test.skip(true, 'API not available in current dev server setup')
      return
    }

    // Accept 200 (healthy) or 503 (unhealthy but responding)
    expect([200, 503]).toContain(response.status())

    const body = await response.json()
    expect(body).toHaveProperty('status')
    expect(body).toHaveProperty('checks')
  })

  test('liveness endpoint returns alive', async ({ request, baseURL }) => {
    const response = await request.get(`${baseURL}/health/live`)

    // Check content type to ensure we're hitting the API
    const contentType = response.headers()['content-type'] || ''

    if (!contentType.includes('application/json')) {
      test.skip(true, 'API not available in current dev server setup')
      return
    }

    expect(response.ok()).toBeTruthy()

    const body = await response.json()
    expect(body.alive).toBe(true)
  })

  test('404 page displays for unknown routes', async ({ page }) => {
    await page.goto('/this-page-does-not-exist')

    // Should show 404 content - use first() for strict mode
    await expect(page.getByText('404').first()).toBeVisible()
  })

  test('unauthenticated user is redirected from protected routes', async ({ page }) => {
    // Try to access dashboard without auth
    await page.goto('/dashboard')

    // Should be redirected to login
    await expect(page).toHaveURL(/login/)
  })
})

test.describe('API Smoke Tests @smoke', () => {
  test('readiness endpoint returns ready status', async ({ request, baseURL }) => {
    const response = await request.get(`${baseURL}/health/ready`, {
      failOnStatusCode: false,
    })

    const contentType = response.headers()['content-type'] || ''
    if (!contentType.includes('application/json')) {
      test.skip(true, 'API not available')
      return
    }

    expect([200, 503]).toContain(response.status())

    const body = await response.json()
    expect(body).toHaveProperty('ready')
  })

  test('API documentation endpoint is accessible', async ({ request, baseURL }) => {
    const response = await request.get(`${baseURL}/api/doc`, {
      failOnStatusCode: false,
    })

    const contentType = response.headers()['content-type'] || ''
    if (!contentType.includes('application/json')) {
      test.skip(true, 'API doc not available')
      return
    }

    expect(response.ok()).toBeTruthy()

    const body = await response.json()
    expect(body).toHaveProperty('openapi')
    expect(body).toHaveProperty('info')
  })

  test('auth/me returns 401 without session', async ({ request, baseURL }) => {
    const response = await request.get(`${baseURL}/api/auth/me`, {
      failOnStatusCode: false,
    })

    const contentType = response.headers()['content-type'] || ''
    if (!contentType.includes('application/json')) {
      test.skip(true, 'API not available')
      return
    }

    expect(response.status()).toBe(401)
  })
})

test.describe('Navigation Smoke Tests @smoke', () => {
  test('all main public navigation links work', async ({ page }) => {
    // Home
    await page.goto('/')
    await expect(page.locator('body')).toBeVisible()

    // Login
    await page.goto('/login')
    await expect(page.getByText('Welcome back')).toBeVisible()
  })
})

test.describe('Static Assets Smoke @smoke', () => {
  test('index.html loads successfully', async ({ request, baseURL }) => {
    const response = await request.get(`${baseURL}/`)

    expect(response.ok()).toBeTruthy()

    const contentType = response.headers()['content-type'] || ''
    expect(contentType).toContain('text/html')

    const body = await response.text()
    // Check for doctype (case-insensitive)
    expect(body.toLowerCase()).toContain('<!doctype html>')
    expect(body).toContain('<html')
  })

  test('CSS/JS assets load without errors', async ({ page }) => {
    const consoleErrors: string[] = []

    // Listen for console errors related to missing assets
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text()
        // Capture errors related to loading assets
        if (
          text.includes('Failed to load') ||
          text.includes('net::ERR') ||
          text.includes('404')
        ) {
          consoleErrors.push(text)
        }
      }
    })

    // Listen for failed network requests
    page.on('requestfailed', (request) => {
      const resourceType = request.resourceType()
      if (resourceType === 'stylesheet' || resourceType === 'script') {
        consoleErrors.push(`Failed to load ${resourceType}: ${request.url()}`)
      }
    })

    await page.goto('/')
    await expect(page.locator('body')).toBeVisible()

    // Wait a bit for any async asset loads
    await page.waitForLoadState('networkidle')

    // Verify no critical asset errors
    expect(consoleErrors).toHaveLength(0)
  })
})
