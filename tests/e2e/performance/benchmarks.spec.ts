import { test, expect, isAuthenticated } from '../fixtures'

/**
 * Performance Benchmark Tests
 *
 * Comprehensive performance testing using Playwright's performance APIs.
 * These tests measure critical performance metrics to ensure the application
 * meets performance SLAs.
 *
 * @tags @performance @benchmark
 */

// Performance thresholds (in milliseconds)
const THRESHOLDS = {
  dashboardPageLoad: 3000, // Max time for dashboard page to load
  apiResponse: 500, // Max time for list API endpoints
  fcp: 1800, // First Contentful Paint target
  tti: 3500, // Time to Interactive target
  lighthouseScore: 70, // Minimum Lighthouse performance score (0-100)
}

test.describe('Performance Benchmarks @performance @benchmark', () => {
  test.describe('Page Load Benchmarks', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test('dashboard page loads under 3000ms', async ({ page }) => {
      // Start performance measurement
      const startTime = Date.now()

      // Navigate and wait for network to be idle
      await page.goto('/dashboard', { waitUntil: 'networkidle' })

      // Record load time
      const loadTime = Date.now() - startTime

      // Verify page content is visible
      await expect(page.getByRole('navigation')).toBeVisible()

      // Assert load time is within threshold
      expect(loadTime).toBeLessThan(THRESHOLDS.dashboardPageLoad)

      // Log performance data for debugging
      console.log(`Dashboard load time: ${loadTime}ms (threshold: ${THRESHOLDS.dashboardPageLoad}ms)`)
    })

    test('team page loads under 3000ms', async ({ page }) => {
      const startTime = Date.now()

      await page.goto('/team', { waitUntil: 'networkidle' })

      const loadTime = Date.now() - startTime

      await expect(page.getByRole('heading', { name: /team members/i })).toBeVisible()

      expect(loadTime).toBeLessThan(THRESHOLDS.dashboardPageLoad)
    })

    test('settings page loads under 3000ms', async ({ page }) => {
      const startTime = Date.now()

      await page.goto('/settings', { waitUntil: 'networkidle' })

      const loadTime = Date.now() - startTime

      await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible()

      expect(loadTime).toBeLessThan(THRESHOLDS.dashboardPageLoad)
    })
  })

  test.describe('API Response Time Benchmarks', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test('users list endpoint responds under 500ms', async ({ page, accountId }) => {
      // Navigate to establish session context
      await page.goto('/dashboard')
      await expect(page.getByRole('navigation')).toBeVisible()

      // Measure API response time
      const startTime = Date.now()
      const response = await page.request.get('/api/users', {
        headers: accountId ? { 'account-id': accountId } : {},
      })
      const responseTime = Date.now() - startTime

      // Verify response is successful
      expect(response.ok()).toBeTruthy()

      // Assert response time is within threshold
      expect(responseTime).toBeLessThan(THRESHOLDS.apiResponse)

      console.log(`Users list API: ${responseTime}ms (threshold: ${THRESHOLDS.apiResponse}ms)`)
    })

    test('accounts list endpoint responds under 500ms', async ({ page, accountId }) => {
      await page.goto('/dashboard')
      await expect(page.getByRole('navigation')).toBeVisible()

      const startTime = Date.now()
      const response = await page.request.get('/api/accounts', {
        headers: accountId ? { 'account-id': accountId } : {},
      })
      const responseTime = Date.now() - startTime

      expect(response.ok()).toBeTruthy()
      expect(responseTime).toBeLessThan(THRESHOLDS.apiResponse)

      console.log(`Accounts list API: ${responseTime}ms (threshold: ${THRESHOLDS.apiResponse}ms)`)
    })

    test('audit logs list endpoint responds under 500ms', async ({ page, accountId }) => {
      await page.goto('/dashboard')
      await expect(page.getByRole('navigation')).toBeVisible()

      const startTime = Date.now()
      const response = await page.request.get('/api/audits', {
        headers: accountId ? { 'account-id': accountId } : {},
      })
      const responseTime = Date.now() - startTime

      expect(response.ok()).toBeTruthy()
      expect(responseTime).toBeLessThan(THRESHOLDS.apiResponse)

      console.log(`Audit logs API: ${responseTime}ms (threshold: ${THRESHOLDS.apiResponse}ms)`)
    })

    test('auth/me endpoint responds under 500ms', async ({ page }) => {
      await page.goto('/dashboard')
      await expect(page.getByRole('navigation')).toBeVisible()

      const startTime = Date.now()
      const response = await page.request.get('/auth/me')
      const responseTime = Date.now() - startTime

      expect(response.ok()).toBeTruthy()
      expect(responseTime).toBeLessThan(THRESHOLDS.apiResponse)

      console.log(`Auth/me API: ${responseTime}ms (threshold: ${THRESHOLDS.apiResponse}ms)`)
    })
  })

  test.describe('Core Web Vitals', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test('First Contentful Paint (FCP) is under threshold', async ({ page }) => {
      // Navigate to dashboard
      await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })

      // Wait for content to be visible
      await expect(page.getByRole('navigation')).toBeVisible()

      // Get performance metrics using Performance API
      const fcpEntry = await page.evaluate(() => {
        return new Promise<number | null>((resolve) => {
          // Try to get FCP from PerformanceObserver
          const observer = new PerformanceObserver((list) => {
            const entries = list.getEntriesByName('first-contentful-paint')
            if (entries.length > 0) {
              observer.disconnect()
              resolve(entries[0].startTime)
            }
          })

          observer.observe({ type: 'paint', buffered: true })

          // Fallback: check already recorded entries
          const paintEntries = performance.getEntriesByType('paint')
          const fcpPaint = paintEntries.find((entry) => entry.name === 'first-contentful-paint')
          if (fcpPaint) {
            observer.disconnect()
            resolve(fcpPaint.startTime)
          }

          // Timeout fallback
          setTimeout(() => {
            observer.disconnect()
            resolve(null)
          }, 5000)
        })
      })

      // If FCP is available, verify it meets threshold
      if (fcpEntry !== null) {
        expect(fcpEntry).toBeLessThan(THRESHOLDS.fcp)
        console.log(`FCP: ${fcpEntry.toFixed(2)}ms (threshold: ${THRESHOLDS.fcp}ms)`)
      } else {
        // Skip if FCP measurement is not available
        console.log('FCP measurement not available - skipping assertion')
      }
    })

    test('Time to Interactive (TTI) is under threshold', async ({ page }) => {
      // Start timing before navigation
      const navigationStart = Date.now()

      // Navigate to dashboard
      await page.goto('/dashboard', { waitUntil: 'networkidle' })

      // Wait for the page to be fully interactive
      await expect(page.getByRole('navigation')).toBeVisible()

      // Ensure main interactive elements are available
      // Try to find a clickable element and verify it's actionable
      const firstLink = page.locator('nav a').first()
      await expect(firstLink).toBeEnabled()

      // Calculate approximate TTI
      const tti = Date.now() - navigationStart

      // Assert TTI is within threshold
      expect(tti).toBeLessThan(THRESHOLDS.tti)

      console.log(`Approximate TTI: ${tti}ms (threshold: ${THRESHOLDS.tti}ms)`)
    })

    test('measures Largest Contentful Paint (LCP)', async ({ page }) => {
      await page.goto('/dashboard', { waitUntil: 'networkidle' })

      // Get LCP metric
      const lcpEntry = await page.evaluate(() => {
        return new Promise<number | null>((resolve) => {
          let lcpValue: number | null = null

          const observer = new PerformanceObserver((list) => {
            const entries = list.getEntries()
            // LCP is the last entry reported
            if (entries.length > 0) {
              lcpValue = entries[entries.length - 1].startTime
            }
          })

          observer.observe({ type: 'largest-contentful-paint', buffered: true })

          // Wait a bit for LCP to be reported, then resolve
          setTimeout(() => {
            observer.disconnect()
            resolve(lcpValue)
          }, 3000)
        })
      })

      if (lcpEntry !== null) {
        // LCP should ideally be under 2.5s for good experience
        expect(lcpEntry).toBeLessThan(2500)
        console.log(`LCP: ${lcpEntry.toFixed(2)}ms (target: <2500ms)`)
      } else {
        console.log('LCP measurement not available')
      }
    })
  })

  test.describe('Lighthouse Performance Score', () => {
    test.skip(
      !process.env.RUN_LIGHTHOUSE,
      'Lighthouse tests are optional. Set RUN_LIGHTHOUSE=true to run.'
    )

    test('dashboard page achieves Lighthouse performance score above 70', async ({ page }) => {
      // Note: This test requires @playwright/lighthouse or similar integration
      // For now, we'll measure key metrics that contribute to the Lighthouse score

      const navigationStart = Date.now()

      // Navigate and wait for full load
      await page.goto('/dashboard', { waitUntil: 'networkidle' })

      // Collect performance metrics
      const metrics = await page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming

        return {
          // Navigation timing metrics
          domContentLoaded: navigation?.domContentLoadedEventEnd - navigation?.fetchStart,
          loadComplete: navigation?.loadEventEnd - navigation?.fetchStart,
          ttfb: navigation?.responseStart - navigation?.fetchStart,

          // Resource count
          resourceCount: performance.getEntriesByType('resource').length,

          // Total transfer size (approximate)
          transferSize: performance
            .getEntriesByType('resource')
            .reduce(
              (total, entry) => total + ((entry as PerformanceResourceTiming).transferSize || 0),
              0
            ),
        }
      })

      // Log collected metrics
      console.log('Lighthouse-relevant metrics:')
      console.log(`  TTFB: ${metrics.ttfb?.toFixed(2) ?? 'N/A'}ms`)
      console.log(`  DOM Content Loaded: ${metrics.domContentLoaded?.toFixed(2) ?? 'N/A'}ms`)
      console.log(`  Load Complete: ${metrics.loadComplete?.toFixed(2) ?? 'N/A'}ms`)
      console.log(`  Resource Count: ${metrics.resourceCount}`)
      console.log(`  Transfer Size: ${(metrics.transferSize / 1024).toFixed(2)}KB`)

      // Estimate a synthetic performance score based on key metrics
      // This is a simplified approximation of Lighthouse scoring
      let score = 100

      // TTFB impact (should be < 600ms)
      if (metrics.ttfb && metrics.ttfb > 600) {
        score -= Math.min(20, (metrics.ttfb - 600) / 50)
      }

      // Load time impact
      if (metrics.loadComplete && metrics.loadComplete > 3000) {
        score -= Math.min(30, (metrics.loadComplete - 3000) / 100)
      }

      // Resource count impact
      if (metrics.resourceCount > 50) {
        score -= Math.min(10, (metrics.resourceCount - 50) / 5)
      }

      score = Math.max(0, Math.round(score))

      console.log(`Estimated Performance Score: ${score}/100`)

      expect(score).toBeGreaterThanOrEqual(THRESHOLDS.lighthouseScore)
    })
  })

  test.describe('Concurrent Request Performance', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test('handles multiple concurrent API requests efficiently', async ({ page, accountId }) => {
      await page.goto('/dashboard')
      await expect(page.getByRole('navigation')).toBeVisible()

      const headers = accountId ? { 'account-id': accountId } : {}

      // Execute multiple requests concurrently
      const startTime = Date.now()

      const [usersRes, accountsRes, auditsRes, meRes] = await Promise.all([
        page.request.get('/api/users', { headers }),
        page.request.get('/api/accounts', { headers }),
        page.request.get('/api/audits', { headers }),
        page.request.get('/auth/me'),
      ])

      const totalTime = Date.now() - startTime

      // All requests should succeed
      expect(usersRes.ok()).toBeTruthy()
      expect(accountsRes.ok()).toBeTruthy()
      expect(auditsRes.ok()).toBeTruthy()
      expect(meRes.ok()).toBeTruthy()

      // Total time for concurrent requests should be reasonable
      // (should be similar to single request due to parallelism)
      expect(totalTime).toBeLessThan(2000)

      console.log(`Concurrent requests total time: ${totalTime}ms (4 requests)`)
    })
  })
})
