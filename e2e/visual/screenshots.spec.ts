import { test, expect, isAuthenticated } from '../fixtures'

/**
 * Visual Regression E2E Tests
 *
 * These tests capture full-page screenshots for visual comparison.
 * Dynamic content (avatars, timestamps, counts) is masked to prevent flaky diffs.
 *
 * Run with: npx playwright test --grep @visual
 *
 * First run creates baseline screenshots in e2e/visual/screenshots.spec.ts-snapshots/
 * Subsequent runs compare against baselines and report differences.
 *
 * @tags @visual
 */

test.describe('Visual Regression @visual', () => {
  // Shared screenshot options for consistency
  const screenshotOptions = {
    maxDiffPixelRatio: 0.02,
    fullPage: true,
  }

  test.describe('Public Pages', () => {
    test('login page visual snapshot', async ({ page }) => {
      await page.goto('/login')
      await page.waitForLoadState('networkidle')

      // Wait for login page content to stabilize
      await expect(page.getByText('Welcome back')).toBeVisible()

      await expect(page).toHaveScreenshot('login-page.png', screenshotOptions)
    })

    test('404 page visual snapshot', async ({ page }) => {
      await page.goto('/this-page-does-not-exist')
      await page.waitForLoadState('networkidle')

      // Wait for 404 content to be visible
      await expect(page.getByText('404').first()).toBeVisible()

      await expect(page).toHaveScreenshot('404-page.png', screenshotOptions)
    })
  })

  test.describe('Authenticated Pages', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test('dashboard page visual snapshot', async ({ page }) => {
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')

      // Wait for dashboard content to load
      await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible()

      // Mask dynamic content: avatars, counts/stats, timestamps
      await expect(page).toHaveScreenshot('dashboard-page.png', {
        ...screenshotOptions,
        mask: [
          // Mask avatars (user images that may change)
          page.locator('[class*="Avatar"]'),
          page.locator('img[alt*="avatar" i]'),
          page.locator('img[alt*="profile" i]'),
          // Mask dynamic stats/counts that may change between runs
          page.locator('[class*="stat"] [class*="value"]'),
          page.locator('[class*="Card"] h2.text-3xl'),
          page.locator('[class*="Card"] .text-3xl'),
          // Mask timestamps/dates
          page.locator('time'),
          page.locator('[class*="date" i]'),
        ],
      })
    })

    test('team page visual snapshot', async ({ page }) => {
      await page.goto('/team')
      await page.waitForLoadState('networkidle')

      // Wait for team page content to load
      await expect(page.getByRole('heading', { name: /team members/i })).toBeVisible()

      // Mask dynamic content: avatars, timestamps, member counts
      await expect(page).toHaveScreenshot('team-page.png', {
        ...screenshotOptions,
        mask: [
          // Mask avatars
          page.locator('[class*="Avatar"]'),
          page.locator('img[alt*="avatar" i]'),
          page.locator('img[alt*="profile" i]'),
          // Mask member counts
          page.locator('text=/\\d+ member/'),
          // Mask timestamps (joined dates, last active, expiry)
          page.locator('time'),
          page.locator('text=/expires in/i'),
          page.locator('text=/ago$/'),
          page.locator('[class*="text-muted"]'),
        ],
      })
    })

    test('settings page visual snapshot', async ({ page }) => {
      await page.goto('/settings')
      await page.waitForLoadState('networkidle')

      // Wait for settings page content to load
      await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible()

      // Mask dynamic content: avatars, user-specific data
      await expect(page).toHaveScreenshot('settings-page.png', {
        ...screenshotOptions,
        mask: [
          // Mask avatars
          page.locator('[class*="Avatar"]'),
          page.locator('img[alt*="avatar" i]'),
          page.locator('img[alt*="profile" i]'),
          // Mask user-specific form values that may differ
          page.locator('input[name="name"]'),
          page.locator('input[name="email"]'),
          page.locator('input[type="email"]'),
        ],
      })
    })

    test('integrations page visual snapshot', async ({ page }) => {
      await page.goto('/integrations')
      await page.waitForLoadState('networkidle')

      // Wait for integrations page content to load
      await expect(page.getByRole('heading', { name: /integrations/i })).toBeVisible()

      // Mask dynamic content: counts, timestamps, delivery status
      await expect(page).toHaveScreenshot('integrations-page.png', {
        ...screenshotOptions,
        mask: [
          // Mask connection counts
          page.locator('text=/\\d+ connected/i'),
          // Mask timestamps (last delivery, etc.)
          page.locator('time'),
          page.locator('text=/last delivery/i'),
          page.locator('text=/ago$/'),
          // Mask avatars if present
          page.locator('[class*="Avatar"]'),
        ],
      })
    })

    test('team invite dialog visual snapshot', async ({ page }) => {
      await page.goto('/team')
      await page.waitForLoadState('networkidle')

      // Wait for team page to load and open invite dialog
      const inviteButton = page.getByRole('button', { name: /invite member/i })
      await expect(inviteButton).toBeVisible()
      await inviteButton.click()

      // Wait for dialog to be fully visible
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()
      await expect(page.getByRole('heading', { name: /invite team member/i })).toBeVisible()

      // Take screenshot of dialog only (not fullPage)
      await expect(dialog).toHaveScreenshot('team-invite-dialog.png', {
        maxDiffPixelRatio: 0.02,
        // Dialog screenshots are not fullPage
      })
    })
  })
})
