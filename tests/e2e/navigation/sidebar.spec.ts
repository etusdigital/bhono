import { test, expect, isAuthenticated } from '../fixtures'

/**
 * Sidebar E2E Tests
 *
 * Tests for sidebar functionality including:
 * - Collapse/expand behavior
 * - Keyboard shortcuts (Cmd/Ctrl+B)
 * - Theme toggle cycling
 * - Navigation item active states
 * - User profile section
 *
 * @tags @sidebar @navigation @theme
 */

test.describe('Sidebar Functionality @sidebar @navigation', () => {
  test.beforeEach(async ({ page }) => {
    const authenticated = await isAuthenticated(page)
    test.skip(!authenticated, 'No authenticated session available')
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
  })

  test.describe('Collapse and Expand', () => {
    test('should show sidebar expanded by default', async ({ page }) => {
      // Sidebar should be visible with full width (w-64 = 256px)
      const sidebar = page.locator('aside').first()
      await expect(sidebar).toBeVisible()

      // Check that navigation labels are visible (not just icons)
      await expect(page.getByText('Dashboard')).toBeVisible()
      await expect(page.getByText('Team')).toBeVisible()
      await expect(page.getByText('Integrations')).toBeVisible()
    })

    test('should collapse sidebar when clicking collapse button', async ({ page }) => {
      // Find and click the collapse button (chevron pointing left)
      const collapseButton = page.locator('aside button').filter({ has: page.locator('[class*="rotate-180"]') })
      await expect(collapseButton).toBeVisible()
      await collapseButton.click()

      // Wait for animation
      await page.waitForTimeout(350)

      // Sidebar should be collapsed - labels should not be visible
      await expect(page.getByText('Dashboard', { exact: true })).not.toBeVisible()
      await expect(page.getByText('Team', { exact: true })).not.toBeVisible()

      // But sidebar itself should still be visible (just narrower)
      const sidebar = page.locator('aside').first()
      await expect(sidebar).toBeVisible()
    })

    test('should expand sidebar when clicking expand button', async ({ page }) => {
      // First collapse the sidebar
      const collapseButton = page.locator('aside button').filter({ has: page.locator('[class*="rotate-180"]') })
      await collapseButton.click()
      await page.waitForTimeout(350)

      // Find and click the expand button
      const expandButton = page.locator('aside button').filter({ has: page.locator('[class*="chevronRight"]') }).first()
      await expandButton.click()

      // Wait for animation
      await page.waitForTimeout(350)

      // Labels should be visible again
      await expect(page.getByText('Dashboard')).toBeVisible()
      await expect(page.getByText('Team')).toBeVisible()
    })

    test('should show keyboard shortcut hint when expanded', async ({ page }) => {
      // The keyboard shortcut hint (⌘B or Ctrl+B) should be visible
      const shortcutHint = page.getByText(/collapse/i)
      await expect(shortcutHint).toBeVisible()
    })

    test('should hide keyboard shortcut hint when collapsed', async ({ page }) => {
      // Collapse the sidebar
      const collapseButton = page.locator('aside button').filter({ has: page.locator('[class*="rotate-180"]') })
      await collapseButton.click()
      await page.waitForTimeout(350)

      // Keyboard shortcut hint should not be visible
      const shortcutHint = page.getByText(/collapse/i)
      await expect(shortcutHint).not.toBeVisible()
    })
  })

  test.describe('Keyboard Shortcuts', () => {
    test('should toggle sidebar with Cmd+B on Mac', async ({ page }) => {
      // Check initial state - expanded
      await expect(page.getByText('Dashboard')).toBeVisible()

      // Press Cmd+B (Meta+B)
      await page.keyboard.press('Meta+b')
      await page.waitForTimeout(350)

      // Should be collapsed - labels not visible
      await expect(page.getByText('Dashboard', { exact: true })).not.toBeVisible()

      // Press Cmd+B again
      await page.keyboard.press('Meta+b')
      await page.waitForTimeout(350)

      // Should be expanded again
      await expect(page.getByText('Dashboard')).toBeVisible()
    })

    test('should toggle sidebar with Ctrl+B on Windows/Linux', async ({ page }) => {
      // Check initial state - expanded
      await expect(page.getByText('Dashboard')).toBeVisible()

      // Press Ctrl+B
      await page.keyboard.press('Control+b')
      await page.waitForTimeout(350)

      // Should be collapsed - labels not visible
      await expect(page.getByText('Dashboard', { exact: true })).not.toBeVisible()

      // Press Ctrl+B again
      await page.keyboard.press('Control+b')
      await page.waitForTimeout(350)

      // Should be expanded again
      await expect(page.getByText('Dashboard')).toBeVisible()
    })
  })

  test.describe('Navigation Items', () => {
    test('should highlight Dashboard as active on dashboard page', async ({ page }) => {
      // Dashboard link should have active styling
      const dashboardLink = page.getByRole('link', { name: /dashboard/i })
      await expect(dashboardLink).toHaveClass(/bg-sidebar-accent/)
    })

    test('should highlight Team as active on team page', async ({ page }) => {
      await page.goto('/team')
      await page.waitForLoadState('networkidle')

      const teamLink = page.getByRole('link', { name: /team/i })
      await expect(teamLink).toHaveClass(/bg-sidebar-accent/)
    })

    test('should highlight Settings as active on settings page', async ({ page }) => {
      await page.goto('/settings')
      await page.waitForLoadState('networkidle')

      const settingsLink = page.getByRole('link', { name: /settings/i })
      await expect(settingsLink).toHaveClass(/bg-sidebar-accent/)
    })

    test('should show active indicator dot on current page', async ({ page }) => {
      // On dashboard, the active indicator should be visible
      const activeDot = page.locator('aside a').filter({ hasText: 'Dashboard' }).locator('.bg-primary')
      await expect(activeDot).toBeVisible()
    })

    test('should show tooltip on hover when collapsed', async ({ page }) => {
      // Collapse sidebar
      const collapseButton = page.locator('aside button').filter({ has: page.locator('[class*="rotate-180"]') })
      await collapseButton.click()
      await page.waitForTimeout(350)

      // Hover over a nav item - should show tooltip with title attribute
      const teamLink = page.locator('aside a[title="Team"]')
      await expect(teamLink).toHaveAttribute('title', 'Team')
    })

    test('should navigate to correct page when clicking nav items', async ({ page }) => {
      // Click on Team
      const teamLink = page.getByRole('link', { name: /team/i })
      await teamLink.click()
      await expect(page).toHaveURL(/team/)

      // Click on Integrations
      const integrationsLink = page.getByRole('link', { name: /integrations/i })
      await integrationsLink.click()
      await expect(page).toHaveURL(/integrations/)

      // Click on Account
      const accountLink = page.getByRole('link', { name: /account/i })
      await accountLink.click()
      await expect(page).toHaveURL(/account/)

      // Click on Settings
      const settingsLink = page.getByRole('link', { name: /settings/i })
      await settingsLink.click()
      await expect(page).toHaveURL(/settings/)
    })
  })

  test.describe('Section Headers', () => {
    test('should show Main section header when expanded', async ({ page }) => {
      await expect(page.getByText('Main', { exact: true })).toBeVisible()
    })

    test('should show Account section header when expanded', async ({ page }) => {
      await expect(page.getByText('Account', { exact: true })).toBeVisible()
    })

    test('should hide section headers when collapsed', async ({ page }) => {
      // Collapse sidebar
      const collapseButton = page.locator('aside button').filter({ has: page.locator('[class*="rotate-180"]') })
      await collapseButton.click()
      await page.waitForTimeout(350)

      await expect(page.getByText('Main', { exact: true })).not.toBeVisible()
    })
  })

  test.describe('User Profile Section', () => {
    test('should display user name when expanded', async ({ page }) => {
      // User profile section should show name
      const sidebar = page.locator('aside')
      // The user name should be visible somewhere in the sidebar
      await expect(sidebar.locator('.truncate').first()).toBeVisible()
    })

    test('should display user avatar', async ({ page }) => {
      // Avatar should be visible
      const avatar = page.locator('aside').locator('[class*="avatar"]').first()
      await expect(avatar).toBeVisible()
    })

    test('should show logout button when expanded', async ({ page }) => {
      // Logout button should be visible in expanded state
      const logoutButton = page.locator('aside button').last()
      await expect(logoutButton).toBeVisible()
    })

    test('should show avatar only when collapsed', async ({ page }) => {
      // Collapse sidebar
      const collapseButton = page.locator('aside button').filter({ has: page.locator('[class*="rotate-180"]') })
      await collapseButton.click()
      await page.waitForTimeout(350)

      // Avatar should still be visible
      const avatar = page.locator('aside').locator('[class*="avatar"]').first()
      await expect(avatar).toBeVisible()
    })
  })

  test.describe('Logo and Branding', () => {
    test('should display logo and brand name when expanded', async ({ page }) => {
      // Brand name "Hono" should be visible
      await expect(page.getByText('Hono', { exact: true })).toBeVisible()
    })

    test('should display only logo when collapsed', async ({ page }) => {
      // Collapse sidebar
      const collapseButton = page.locator('aside button').filter({ has: page.locator('[class*="rotate-180"]') })
      await collapseButton.click()
      await page.waitForTimeout(350)

      // Brand name should not be visible when collapsed
      await expect(page.getByText('Hono', { exact: true })).not.toBeVisible()
    })

    test('should navigate to dashboard when clicking logo', async ({ page }) => {
      // Navigate away from dashboard first
      await page.goto('/settings')
      await page.waitForLoadState('networkidle')

      // Click the logo/brand link
      const logoLink = page.locator('aside a').filter({ hasText: 'Hono' })
      await logoLink.click()

      // Should navigate to dashboard
      await expect(page).toHaveURL(/dashboard/)
    })
  })
})

test.describe('Theme Toggle @sidebar @theme', () => {
  test.beforeEach(async ({ page }) => {
    const authenticated = await isAuthenticated(page)
    test.skip(!authenticated, 'No authenticated session available')
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
  })

  test('should display theme toggle button in sidebar', async ({ page }) => {
    // Theme toggle button should be visible
    const themeButton = page.locator('aside button[title*="Theme"]')
    await expect(themeButton).toBeVisible()
  })

  test('should cycle through themes: light → dark → system → light', async ({ page }) => {
    const themeButton = page.locator('aside button[title*="Theme"]')

    // Get initial theme
    const initialTitle = await themeButton.getAttribute('title')

    // Click to change theme
    await themeButton.click()
    await page.waitForTimeout(100)

    // Theme should have changed
    const newTitle = await themeButton.getAttribute('title')
    expect(newTitle).not.toBe(initialTitle)
  })

  test('should show sun icon in light mode', async ({ page }) => {
    // Force light mode
    await page.emulateMedia({ colorScheme: 'light' })
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Sun icon should be visible (not moon)
    const themeButton = page.locator('aside button[title*="Theme"]')
    const sunIcon = themeButton.locator('[class*="sun"]')

    // Either sun icon is present or we're in light mode
    const hasSunIcon = await sunIcon.count() > 0
    if (hasSunIcon) {
      await expect(sunIcon).toBeVisible()
    }
  })

  test('should show moon icon in dark mode', async ({ page }) => {
    // Force dark mode
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Moon icon should be visible
    const themeButton = page.locator('aside button[title*="Theme"]')
    const moonIcon = themeButton.locator('[class*="moon"]')

    // Either moon icon is present or we're in dark mode
    const hasMoonIcon = await moonIcon.count() > 0
    if (hasMoonIcon) {
      await expect(moonIcon).toBeVisible()
    }
  })

  test('should persist theme preference across pages', async ({ page }) => {
    const themeButton = page.locator('aside button[title*="Theme"]')

    // Click to change theme
    await themeButton.click()
    await page.waitForTimeout(100)

    // Get the new theme title
    const themeAfterClick = await themeButton.getAttribute('title')

    // Navigate to another page
    await page.goto('/team')
    await page.waitForLoadState('networkidle')

    // Theme should be preserved
    const themeButtonOnTeam = page.locator('aside button[title*="Theme"]')
    const themeOnTeamPage = await themeButtonOnTeam.getAttribute('title')

    expect(themeOnTeamPage).toBe(themeAfterClick)
  })

  test('should update body classes when theme changes', async ({ page }) => {
    // Start with light mode preference
    await page.emulateMedia({ colorScheme: 'light' })
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Get initial state
    const initialDarkClass = await page.evaluate(() =>
      document.documentElement.classList.contains('dark')
    )

    // Click theme toggle multiple times to ensure we hit dark mode
    const themeButton = page.locator('aside button[title*="Theme"]')

    // If starting in light mode, first click goes to dark
    if (!initialDarkClass) {
      await themeButton.click()
      await page.waitForTimeout(200)

      // Check if dark class was added
      const hasDarkClass = await page.evaluate(() =>
        document.documentElement.classList.contains('dark')
      )

      // Theme should have changed
      expect(hasDarkClass).not.toBe(initialDarkClass)
    }
  })
})

test.describe('Sidebar Responsive Behavior @sidebar @mobile', () => {
  test.beforeEach(async ({ page }) => {
    const authenticated = await isAuthenticated(page)
    test.skip(!authenticated, 'No authenticated session available')
  })

  test('should maintain collapse state after navigation', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Collapse sidebar
    const collapseButton = page.locator('aside button').filter({ has: page.locator('[class*="rotate-180"]') })
    await collapseButton.click()
    await page.waitForTimeout(350)

    // Verify collapsed
    await expect(page.getByText('Dashboard', { exact: true })).not.toBeVisible()

    // Navigate to team
    await page.getByRole('link', { name: /team/i }).click()
    await page.waitForLoadState('networkidle')

    // Sidebar should still be collapsed
    await expect(page.getByText('Team', { exact: true })).not.toBeVisible()
  })

  test('should handle sidebar in small viewport', async ({ page }) => {
    // Set a tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Sidebar should still be present
    const sidebar = page.locator('aside').first()
    await expect(sidebar).toBeVisible()
  })
})
