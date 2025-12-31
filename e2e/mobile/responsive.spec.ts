import { test, expect, isAuthenticated } from '../fixtures'

/**
 * Mobile Responsive E2E Tests
 *
 * Tests for mobile responsiveness and touch-friendly UI.
 * Runs with mobile-chrome project (Pixel 5 device).
 *
 * Run with: npx playwright test --project=mobile-chrome
 *
 * @tags @mobile
 */

test.describe('Mobile Responsive Tests @mobile', () => {
  // Touch target minimum: 44x44px (Apple) or 48x48dp (Google)
  // We use 40px as a reasonable minimum for buttons
  const MIN_TOUCH_TARGET = 40

  test.describe('Public Pages', () => {
    test('home page is responsive', async ({ page }) => {
      await page.goto('/')

      // Page should load without horizontal scroll
      const viewport = page.viewportSize()
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
      expect(bodyWidth).toBeLessThanOrEqual(viewport!.width + 1) // Allow 1px tolerance

      // Main content should be visible
      await expect(page.locator('body')).toBeVisible()

      // Login/Get Started link should be visible and accessible
      const loginLink = page.getByRole('link', { name: /login|sign in|get started/i })
      await expect(loginLink.first()).toBeVisible()

      // Check touch target size for primary CTA
      const boundingBox = await loginLink.first().boundingBox()
      expect(boundingBox).not.toBeNull()
      expect(boundingBox!.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET)
    })

    test('login page is responsive with touch-friendly buttons', async ({ page }) => {
      await page.goto('/login')

      // Page should load without horizontal scroll
      const viewport = page.viewportSize()
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
      expect(bodyWidth).toBeLessThanOrEqual(viewport!.width + 1)

      // Welcome text should be visible
      await expect(page.getByText('Welcome back')).toBeVisible()

      // Google OAuth button should be visible
      const googleButton = page.getByRole('button', { name: /continue with google/i })
      await expect(googleButton).toBeVisible()

      // Check button has adequate touch target size (>= 40px height)
      const buttonBox = await googleButton.boundingBox()
      expect(buttonBox).not.toBeNull()
      expect(buttonBox!.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET)
    })

    test('404 page is responsive', async ({ page }) => {
      await page.goto('/this-page-does-not-exist')

      // Page should load without horizontal scroll
      const viewport = page.viewportSize()
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
      expect(bodyWidth).toBeLessThanOrEqual(viewport!.width + 1)

      // 404 content should be visible
      await expect(page.getByText('404').first()).toBeVisible()

      // If there's a "Go Home" or "Back" link, it should be touch-friendly
      const homeLink = page.getByRole('link', { name: /home|back|return/i })
      if (await homeLink.isVisible({ timeout: 2000 }).catch(() => false)) {
        const linkBox = await homeLink.boundingBox()
        expect(linkBox).not.toBeNull()
        expect(linkBox!.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET)
      }
    })
  })

  test.describe('Authenticated Pages', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test('dashboard is responsive with visible stats cards', async ({ page }) => {
      await page.goto('/dashboard')

      // Page should load without horizontal scroll
      const viewport = page.viewportSize()
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
      expect(bodyWidth).toBeLessThanOrEqual(viewport!.width + 1)

      // Dashboard should not redirect to login
      await expect(page).not.toHaveURL(/login/)

      // Look for dashboard heading or stats cards
      const dashboardHeading = page.getByRole('heading', { name: /dashboard/i })
      await expect(dashboardHeading).toBeVisible()

      // Stats cards should be visible (common dashboard elements)
      const statsCards = page.locator('[class*="Card"]')
      const cardCount = await statsCards.count()

      if (cardCount > 0) {
        // First stats card should be visible
        await expect(statsCards.first()).toBeVisible()

        // Cards should fit within viewport (not overflowing)
        const firstCardBox = await statsCards.first().boundingBox()
        expect(firstCardBox).not.toBeNull()
        expect(firstCardBox!.x).toBeGreaterThanOrEqual(0)
        expect(firstCardBox!.x + firstCardBox!.width).toBeLessThanOrEqual(viewport!.width + 10)
      }
    })

    test('navigation is accessible on mobile', async ({ page }) => {
      await page.goto('/dashboard')

      // Check for either hamburger menu or visible navigation
      const hamburgerMenu = page.getByRole('button', { name: /menu|toggle|hamburger/i })
      const mainNav = page.getByRole('navigation')

      const hasHamburger = await hamburgerMenu.isVisible({ timeout: 3000 }).catch(() => false)
      const hasNav = await mainNav.isVisible({ timeout: 3000 }).catch(() => false)

      // Either navigation is directly visible or accessible via hamburger menu
      expect(hasHamburger || hasNav).toBeTruthy()

      if (hasHamburger) {
        // Open hamburger menu
        await hamburgerMenu.click()

        // Navigation links should be visible after opening menu
        const navLinks = page.getByRole('link')
        await expect(navLinks.first()).toBeVisible()
      }

      // Key navigation links should be accessible
      const dashboardLink = page.getByRole('link', { name: /dashboard/i })
      const settingsLink = page.getByRole('link', { name: /settings/i })
      const teamLink = page.getByRole('link', { name: /team/i })

      // At least one nav link should be visible (directly or in menu)
      const anyNavVisible =
        (await dashboardLink.isVisible({ timeout: 2000 }).catch(() => false)) ||
        (await settingsLink.isVisible({ timeout: 2000 }).catch(() => false)) ||
        (await teamLink.isVisible({ timeout: 2000 }).catch(() => false))

      expect(anyNavVisible).toBeTruthy()
    })

    test('team page is responsive with visible invite button and search', async ({ page }) => {
      await page.goto('/team')

      // Page should load without horizontal scroll
      const viewport = page.viewportSize()
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
      expect(bodyWidth).toBeLessThanOrEqual(viewport!.width + 1)

      // Team heading should be visible
      await expect(page.getByRole('heading', { name: /team members/i })).toBeVisible()

      // Invite button should be visible and touch-friendly
      const inviteButton = page.getByRole('button', { name: /invite member/i })
      await expect(inviteButton).toBeVisible()

      const inviteButtonBox = await inviteButton.boundingBox()
      expect(inviteButtonBox).not.toBeNull()
      expect(inviteButtonBox!.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET)

      // Search input should be visible
      const searchInput = page.getByPlaceholder(/search members/i)
      await expect(searchInput).toBeVisible()

      // Search input should be full width or nearly full width on mobile
      const searchBox = await searchInput.boundingBox()
      expect(searchBox).not.toBeNull()
      expect(searchBox!.width).toBeGreaterThanOrEqual(viewport!.width * 0.5) // At least 50% of viewport
    })

    test('team invite dialog works on mobile', async ({ page }) => {
      await page.goto('/team')

      // Open invite dialog
      const inviteButton = page.getByRole('button', { name: /invite member/i })
      await inviteButton.click()

      // Dialog should be visible
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()

      // Dialog should fit within viewport (not overflowing)
      const viewport = page.viewportSize()
      const dialogBox = await dialog.boundingBox()
      expect(dialogBox).not.toBeNull()
      expect(dialogBox!.width).toBeLessThanOrEqual(viewport!.width)

      // Email input should be visible and usable
      const emailInput = page.getByLabel(/email address/i)
      await expect(emailInput).toBeVisible()
      await expect(emailInput).toBeEnabled()

      // Email input should be wide enough for input
      const emailInputBox = await emailInput.boundingBox()
      expect(emailInputBox).not.toBeNull()
      expect(emailInputBox!.width).toBeGreaterThanOrEqual(200)

      // Role selection buttons should be visible
      await expect(page.getByRole('button', { name: /^member$/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /^admin$/i })).toBeVisible()

      // Send button should be visible and touch-friendly
      const sendButton = page.getByRole('button', { name: /send invitation/i })
      await expect(sendButton).toBeVisible()

      const sendButtonBox = await sendButton.boundingBox()
      expect(sendButtonBox).not.toBeNull()
      expect(sendButtonBox!.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET)

      // Cancel should close dialog
      const cancelButton = page.getByRole('button', { name: /cancel/i })
      await cancelButton.click()
      await expect(dialog).not.toBeVisible()
    })

    test('settings page tabs work on mobile', async ({ page }) => {
      await page.goto('/settings')

      // Page should load without horizontal scroll
      const viewport = page.viewportSize()
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
      expect(bodyWidth).toBeLessThanOrEqual(viewport!.width + 1)

      // Settings heading should be visible
      await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible()

      // Tab buttons should be visible and touch-friendly
      const profileTab = page.getByRole('tab', { name: /profile/i })
      const accountTab = page.getByRole('tab', { name: /account/i })
      const notificationsTab = page.getByRole('tab', { name: /notifications/i })

      await expect(profileTab).toBeVisible()
      await expect(accountTab).toBeVisible()
      await expect(notificationsTab).toBeVisible()

      // Tabs should have adequate touch target size
      const profileTabBox = await profileTab.boundingBox()
      expect(profileTabBox).not.toBeNull()
      expect(profileTabBox!.height).toBeGreaterThanOrEqual(32) // Tabs can be slightly smaller

      // Profile tab should be selected by default
      await expect(profileTab).toHaveAttribute('aria-selected', 'true')

      // Click Account tab - should work on mobile
      await accountTab.click()
      await expect(accountTab).toHaveAttribute('aria-selected', 'true')

      // Account tab content should be visible
      await expect(page.getByText(/change password|account settings|email/i)).toBeVisible()

      // Click Notifications tab - should work on mobile
      await notificationsTab.click()
      await expect(notificationsTab).toHaveAttribute('aria-selected', 'true')

      // Notifications tab content should be visible
      await expect(page.getByText(/notifications|email preferences|updates/i)).toBeVisible()
    })

    test('integrations page is responsive', async ({ page }) => {
      await page.goto('/integrations')

      // Page should load without horizontal scroll
      const viewport = page.viewportSize()
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
      expect(bodyWidth).toBeLessThanOrEqual(viewport!.width + 1)

      // Page heading should be visible
      await expect(page.getByRole('heading', { name: /integrations/i })).toBeVisible()

      // Search input should be visible
      const searchInput = page.getByPlaceholder(/search integrations/i)
      await expect(searchInput).toBeVisible()

      // Category filter buttons should be visible
      await expect(page.getByRole('button', { name: /^all$/i })).toBeVisible()

      // At least one category button should be visible (may need horizontal scroll)
      const categoryButtons = page.getByRole('button', { name: /communication|payments|development|automation/i })
      const categoryCount = await categoryButtons.count()
      expect(categoryCount).toBeGreaterThan(0)

      // Integration cards should be visible and fit viewport
      const integrationCards = page.locator('[class*="Card"]')
      const cardCount = await integrationCards.count()

      if (cardCount > 0) {
        const firstCard = integrationCards.first()
        await expect(firstCard).toBeVisible()

        // Card should fit within viewport
        const cardBox = await firstCard.boundingBox()
        expect(cardBox).not.toBeNull()
        expect(cardBox!.width).toBeLessThanOrEqual(viewport!.width)
      }

      // Connect/Configure buttons should be touch-friendly
      const connectButton = page.getByRole('button', { name: /connect|configure/i }).first()
      if (await connectButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        const buttonBox = await connectButton.boundingBox()
        expect(buttonBox).not.toBeNull()
        expect(buttonBox!.height).toBeGreaterThanOrEqual(32)
      }

      // Add Webhook button should be visible and touch-friendly
      const addWebhookButton = page.getByRole('button', { name: /add webhook/i })
      await expect(addWebhookButton).toBeVisible()

      const webhookButtonBox = await addWebhookButton.boundingBox()
      expect(webhookButtonBox).not.toBeNull()
      expect(webhookButtonBox!.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET)
    })

    test('webhook dialog works on mobile', async ({ page }) => {
      await page.goto('/integrations')

      // Open webhook dialog
      const addWebhookButton = page.getByRole('button', { name: /add webhook/i })
      await addWebhookButton.click()

      // Dialog should be visible
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()

      // Dialog should fit within viewport
      const viewport = page.viewportSize()
      const dialogBox = await dialog.boundingBox()
      expect(dialogBox).not.toBeNull()
      expect(dialogBox!.width).toBeLessThanOrEqual(viewport!.width)

      // URL input should be visible and usable
      const urlInput = page.getByLabel(/endpoint url/i)
      await expect(urlInput).toBeVisible()

      // Event options should be visible
      await expect(page.getByText(/events to subscribe/i)).toBeVisible()
      await expect(page.getByText(/user created/i)).toBeVisible()

      // Create button should be visible
      const createButton = page.getByRole('button', { name: /create webhook/i })
      await expect(createButton).toBeVisible()

      // Cancel and close dialog
      const cancelButton = page.getByRole('button', { name: /cancel/i })
      await cancelButton.click()
      await expect(dialog).not.toBeVisible()
    })
  })
})
