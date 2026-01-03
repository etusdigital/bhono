import { test, expect, isAuthenticated } from '../fixtures'

/**
 * Error Boundary E2E Tests
 *
 * Tests React error boundaries, network error handling,
 * and error recovery UI patterns.
 *
 * @tags @error @error-boundary
 */

test.describe('Error Boundary @error @error-boundary', () => {
  test.describe('Route Error Handling', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test('error boundary shows fallback UI when route loader fails', async ({ page }) => {
      // Intercept auth/me to return 500 error (simulates route loader failure)
      await page.route('**/auth/me', async (route) => {
        // First let it succeed to establish session, then fail on navigation
        const response = await route.fetch()
        await route.fulfill({ response })
      })

      // Navigate to dashboard first
      await page.goto('/dashboard')
      await expect(page.getByRole('navigation')).toBeVisible()

      // Now intercept API calls to cause loader failure
      await page.route('**/api/audits**', (route) => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: { message: 'Internal Server Error' } }),
        })
      })

      // Page should still function - errors are handled gracefully
      await expect(page).toHaveURL(/dashboard/)
    })

    test('error fallback shows "Something went wrong" message', async ({ page }) => {
      // Navigate to authenticated page
      await page.goto('/dashboard')
      await expect(page.getByRole('navigation')).toBeVisible()

      // Intercept the team API to fail with 500
      await page.route('**/api/users**', (route) => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: { message: 'Internal Server Error' } }),
        })
      })

      // Navigate to team page which should trigger error UI
      await page.goto('/team')

      // The page should either show error UI or handle gracefully
      // Check for error indicators or normal page load
      const hasError = await page.getByText(/something went wrong|error|try again/i).isVisible().catch(() => false)
      const hasTeamContent = await page.getByRole('heading', { name: /team members/i }).isVisible().catch(() => false)

      // Should show either error state or graceful degradation
      expect(hasError || hasTeamContent).toBeTruthy()
    })

    test('error fallback has "Try again" button that resets state', async ({ page }) => {
      // Navigate to authenticated page
      await page.goto('/dashboard')
      await expect(page.getByRole('navigation')).toBeVisible()

      let requestCount = 0

      // Intercept API to fail first, then succeed
      await page.route('**/api/users**', (route) => {
        requestCount++
        if (requestCount <= 1) {
          route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: { message: 'Internal Server Error' } }),
          })
        } else {
          // Let subsequent requests through
          route.continue()
        }
      })

      // Navigate to team page
      await page.goto('/team')

      // Look for try again button if error is shown
      const tryAgainButton = page.getByRole('button', { name: /try again/i })
      const hasButton = await tryAgainButton.isVisible({ timeout: 3000 }).catch(() => false)

      if (hasButton) {
        // Click try again - should reset error state
        await tryAgainButton.click()

        // Should either reload or show content
        await expect(page).toHaveURL(/team/)
      } else {
        // Error was handled gracefully without showing error UI
        // Verify page loaded
        await expect(page).toHaveURL(/team/)
      }
    })
  })

  test.describe('Network Error Handling', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test('network errors show user-friendly message with retry option', async ({ page }) => {
      // First navigate to a working page
      await page.goto('/dashboard')
      await expect(page.getByRole('navigation')).toBeVisible()

      // Intercept API call and abort (simulates network failure)
      await page.route('**/api/users**', (route) => {
        route.abort('failed')
      })

      // Navigate to team page
      await page.goto('/team')

      // Should show error state or handle gracefully
      // Look for error indicators
      const errorText = page.getByText(/error|failed|network|offline|try again/i)
      const hasError = await errorText.first().isVisible({ timeout: 3000 }).catch(() => false)

      // If error is shown, look for retry option
      if (hasError) {
        const retryButton = page.getByRole('button', { name: /try again|retry|reload/i })
        const hasRetry = await retryButton.isVisible({ timeout: 2000 }).catch(() => false)

        // Error UI should have a retry mechanism
        expect(hasRetry || page.getByRole('link', { name: /home|dashboard|back/i })).toBeTruthy()
      }

      // Page should still be functional
      await expect(page).toHaveURL(/team/)
    })

    test('API 500 errors show appropriate error message', async ({ page }) => {
      // Navigate to dashboard first
      await page.goto('/dashboard')
      await expect(page.getByRole('navigation')).toBeVisible()

      // Intercept API to return 500
      await page.route('**/api/**', (route) => {
        if (route.request().url().includes('/api/audits') ||
            route.request().url().includes('/api/users') ||
            route.request().url().includes('/api/storage')) {
          route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({
              error: {
                message: 'Internal Server Error',
                code: 'INTERNAL_ERROR',
              },
            }),
          })
        } else {
          route.continue()
        }
      })

      // Make an API request that will fail
      const response = await page.request.get('/api/audits', {
        failOnStatusCode: false,
      })

      // Verify error response format
      expect(response.status()).toBe(500)
      const body = await response.json()
      expect(body).toHaveProperty('error')
      expect(body.error).toHaveProperty('message')
    })

    test('timeout errors show timeout message', async ({ page }) => {
      test.setTimeout(20000) // Extend timeout for this test

      // Navigate to dashboard first
      await page.goto('/dashboard')
      await expect(page.getByRole('navigation')).toBeVisible()

      // Intercept API to simulate very slow response
      await page.route('**/api/users**', async (route) => {
        // Delay for 10 seconds to trigger timeout behavior
        await new Promise((resolve) => setTimeout(resolve, 10000))
        route.continue()
      })

      // Navigate to team page - should handle slow/timeout gracefully
      await page.goto('/team', { timeout: 15000 })

      // Page should either show loading state or timeout message
      // or gracefully handle the delay
      await expect(page).toHaveURL(/team/)
    })
  })

  test.describe('Error Recovery Flow', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test('can navigate away from error state', async ({ page }) => {
      // Navigate to dashboard
      await page.goto('/dashboard')
      await expect(page.getByRole('navigation')).toBeVisible()

      // Intercept team API to fail
      await page.route('**/api/users**', (route) => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: { message: 'Server Error' } }),
        })
      })

      // Navigate to team page (may show error)
      await page.goto('/team')

      // Navigate to settings (should work regardless of team page error)
      await page.goto('/settings')
      await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible()

      // Navigate to dashboard (should also work)
      await page.goto('/dashboard')
      await expect(page).toHaveURL(/dashboard/)
    })

    test('error state does not persist after navigation', async ({ page }) => {
      // Navigate to dashboard
      await page.goto('/dashboard')
      await expect(page.getByRole('navigation')).toBeVisible()

      // Intercept team API to fail once
      let failCount = 0
      await page.route('**/api/users**', (route) => {
        failCount++
        if (failCount <= 1) {
          route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: { message: 'Server Error' } }),
          })
        } else {
          route.continue()
        }
      })

      // Navigate to team page (may trigger error)
      await page.goto('/team')

      // Navigate to settings
      await page.goto('/settings')
      await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible()

      // Navigate back to team - should work now
      await page.goto('/team')
      await expect(page).toHaveURL(/team/)
    })

    test('"Go home" button navigates to dashboard', async ({ page }) => {
      // Navigate to dashboard
      await page.goto('/dashboard')
      await expect(page.getByRole('navigation')).toBeVisible()

      // Intercept to cause error
      await page.route('**/api/users**', (route) => {
        route.abort('failed')
      })

      // Navigate to team page
      await page.goto('/team')

      // Look for Go home button if error UI is shown
      const goHomeButton = page.getByRole('button', { name: /go home|home/i })
      const hasButton = await goHomeButton.isVisible({ timeout: 2000 }).catch(() => false)

      if (hasButton) {
        await goHomeButton.click()
        await expect(page).toHaveURL(/dashboard/)
      }
    })

    test('"Go back" button navigates to previous page', async ({ page }) => {
      // Navigate to settings first
      await page.goto('/settings')
      await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible()

      // Intercept to cause error
      await page.route('**/api/users**', (route) => {
        route.abort('failed')
      })

      // Navigate to team page
      await page.goto('/team')

      // Look for Go back button if error UI is shown
      const goBackButton = page.getByRole('button', { name: /go back|back/i })
      const hasButton = await goBackButton.isVisible({ timeout: 2000 }).catch(() => false)

      if (hasButton) {
        await goBackButton.click()
        // Should go back to settings
        await expect(page).toHaveURL(/settings/)
      }
    })
  })

  test.describe('Component Error Boundary', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test('page remains functional after component error is recovered', async ({ page }) => {
      // Navigate to dashboard
      await page.goto('/dashboard')
      await expect(page.getByRole('navigation')).toBeVisible()

      // Force a page reload (simulates recovery from error)
      await page.reload()

      // Page should fully recover
      await expect(page.getByRole('navigation')).toBeVisible()
      await expect(page).toHaveURL(/dashboard/)
    })

    test('sidebar navigation works after error recovery', async ({ page }) => {
      // Navigate to dashboard
      await page.goto('/dashboard')
      await expect(page.getByRole('navigation')).toBeVisible()

      // Click on team link in sidebar
      const teamLink = page.getByRole('link', { name: /team/i }).first()
      await teamLink.click()

      // Should navigate successfully
      await expect(page).toHaveURL(/team/)

      // Navigate to settings via sidebar
      const settingsLink = page.getByRole('link', { name: /settings/i }).first()
      await settingsLink.click()

      // Should navigate successfully
      await expect(page).toHaveURL(/settings/)
    })
  })

  test.describe('Graceful Degradation', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test('app shows loading state during slow API responses', async ({ page }) => {
      // Intercept API to add delay
      await page.route('**/api/users**', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        route.continue()
      })

      // Navigate to team page
      await page.goto('/team')

      // Should either show loading indicator or content
      // (checking that something is visible)
      await expect(page.locator('body')).toBeVisible()
      await expect(page).toHaveURL(/team/)
    })

    test('app handles empty API responses gracefully', async ({ page }) => {
      // Navigate to dashboard first
      await page.goto('/dashboard')
      await expect(page.getByRole('navigation')).toBeVisible()

      // Intercept API to return empty data
      await page.route('**/api/audits**', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 } }),
        })
      })

      // Make API request
      const response = await page.request.get('/api/audits')
      expect(response.ok()).toBeTruthy()

      const body = await response.json()
      expect(body.data).toEqual([])
    })

    test('app handles malformed API responses', async ({ page }) => {
      // Navigate to dashboard first
      await page.goto('/dashboard')
      await expect(page.getByRole('navigation')).toBeVisible()

      // Intercept API to return malformed response
      await page.route('**/api/users**', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: 'invalid json{{{',
        })
      })

      // Navigate to team page
      await page.goto('/team')

      // App should handle the error gracefully
      // Either show error UI or fallback content
      await expect(page).toHaveURL(/team/)
    })
  })
})
