import { test, expect, isAuthenticated } from '../fixtures'

/**
 * Performance Baseline Tests
 *
 * These tests establish performance baselines for key pages.
 * They measure page load times and ensure they stay within acceptable limits.
 *
 * @tags @performance @baseline
 */

// Performance thresholds (in milliseconds)
const THRESHOLDS = {
  pageLoad: 5000, // Max time for page to be fully interactive
  firstPaint: 2000, // Max time to first meaningful paint
  apiResponse: 1000, // Max time for API responses
}

test.describe('Performance Baselines @performance @baseline', () => {
  test.describe('Public Pages', () => {
    test('login page loads within threshold', async ({ page }) => {
      const startTime = Date.now()

      await page.goto('/login', { waitUntil: 'networkidle' })

      const loadTime = Date.now() - startTime

      // Verify page loaded
      await expect(page.getByText('Welcome back')).toBeVisible()

      // Check load time is within threshold
      expect(loadTime).toBeLessThan(THRESHOLDS.pageLoad)
    })

    test('404 page loads within threshold', async ({ page }) => {
      const startTime = Date.now()

      await page.goto('/non-existent-page', { waitUntil: 'domcontentloaded' })

      const loadTime = Date.now() - startTime

      // Verify 404 content
      await expect(page.getByText('404').first()).toBeVisible()

      // Check load time
      expect(loadTime).toBeLessThan(THRESHOLDS.pageLoad)
    })
  })

  test.describe('Authenticated Pages', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test('dashboard page loads within threshold', async ({ page }) => {
      const startTime = Date.now()

      await page.goto('/dashboard', { waitUntil: 'networkidle' })

      const loadTime = Date.now() - startTime

      // Verify page loaded
      await expect(page.getByRole('navigation')).toBeVisible()

      // Check load time
      expect(loadTime).toBeLessThan(THRESHOLDS.pageLoad)
    })

    test('team page loads within threshold', async ({ page }) => {
      const startTime = Date.now()

      await page.goto('/team', { waitUntil: 'networkidle' })

      const loadTime = Date.now() - startTime

      // Verify page loaded
      await expect(page.getByRole('heading', { name: /team members/i })).toBeVisible()

      // Check load time
      expect(loadTime).toBeLessThan(THRESHOLDS.pageLoad)
    })

    test('settings page loads within threshold', async ({ page }) => {
      const startTime = Date.now()

      await page.goto('/settings', { waitUntil: 'networkidle' })

      const loadTime = Date.now() - startTime

      // Verify page loaded
      await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible()

      // Check load time
      expect(loadTime).toBeLessThan(THRESHOLDS.pageLoad)
    })

    test('integrations page loads within threshold', async ({ page }) => {
      const startTime = Date.now()

      await page.goto('/integrations', { waitUntil: 'networkidle' })

      const loadTime = Date.now() - startTime

      // Verify page loaded
      await expect(page.getByRole('heading', { name: 'Integrations', exact: true })).toBeVisible()

      // Check load time
      expect(loadTime).toBeLessThan(THRESHOLDS.pageLoad)
    })
  })

  test.describe('API Performance', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test('API responses within threshold', async ({ page }) => {
      // Navigate to dashboard first to establish session
      await page.goto('/dashboard')
      await expect(page.getByRole('navigation')).toBeVisible()

      // Test auth/me endpoint performance
      const startTime = Date.now()
      const response = await page.request.get('/auth/me')
      const responseTime = Date.now() - startTime

      expect(response.ok()).toBeTruthy()
      expect(responseTime).toBeLessThan(THRESHOLDS.apiResponse)
    })
  })

  test.describe('Navigation Performance', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test('navigation between pages is responsive', async ({ page }) => {
      // Start at dashboard
      await page.goto('/dashboard', { waitUntil: 'networkidle' })
      await expect(page.getByRole('navigation')).toBeVisible()

      // Navigate to team - measure time
      const teamStart = Date.now()
      await page.goto('/team', { waitUntil: 'domcontentloaded' })
      await expect(page.getByRole('heading', { name: /team members/i })).toBeVisible()
      const teamTime = Date.now() - teamStart

      // Navigate to settings - measure time
      const settingsStart = Date.now()
      await page.goto('/settings', { waitUntil: 'domcontentloaded' })
      await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible()
      const settingsTime = Date.now() - settingsStart

      // Both navigations should be fast
      expect(teamTime).toBeLessThan(THRESHOLDS.pageLoad)
      expect(settingsTime).toBeLessThan(THRESHOLDS.pageLoad)
    })
  })
})
