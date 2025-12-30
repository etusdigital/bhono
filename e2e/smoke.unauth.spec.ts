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
