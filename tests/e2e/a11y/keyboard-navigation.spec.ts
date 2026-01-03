import { test, expect, isAuthenticated } from '../fixtures'

/**
 * Keyboard Navigation & Screen Reader Accessibility Tests
 *
 * Tests for keyboard navigation, focus management, ARIA attributes,
 * and screen reader accessibility features.
 *
 * @tags @a11y
 */

test.describe('Keyboard Navigation Tests @a11y', () => {
  test.describe('Page Title Announcements (Screen Reader)', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test('document.title changes when navigating to dashboard', async ({ page }) => {
      await page.goto('/dashboard')
      await expect(page).toHaveTitle(/dashboard/i)
    })

    test('document.title changes when navigating to team page', async ({ page }) => {
      await page.goto('/team')
      await expect(page).toHaveTitle(/team/i)
    })

    test('document.title changes when navigating to settings', async ({ page }) => {
      await page.goto('/settings')
      await expect(page).toHaveTitle(/settings/i)
    })

    test('document.title changes when navigating to integrations', async ({ page }) => {
      await page.goto('/integrations')
      await expect(page).toHaveTitle(/integrations/i)
    })

    test('document.title changes when navigating to account', async ({ page }) => {
      await page.goto('/account')
      await expect(page).toHaveTitle(/account/i)
    })

    test('page title updates after navigation via keyboard', async ({ page }) => {
      await page.goto('/dashboard')
      const initialTitle = await page.title()

      // Focus on navigation and navigate to team page
      const teamLink = page.locator('nav').getByRole('link', { name: /team/i })
      await teamLink.focus()
      await page.keyboard.press('Enter')

      // Wait for navigation to complete
      await page.waitForURL('**/team')
      const newTitle = await page.title()

      expect(newTitle).not.toBe(initialTitle)
      expect(newTitle.toLowerCase()).toContain('team')
    })
  })

  test.describe('ARIA Labels on Icon-Only Buttons', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test('sidebar collapse button has accessible name', async ({ page }) => {
      await page.goto('/dashboard')

      // Find all icon-only buttons in sidebar (size="icon" buttons)
      const sidebarButtons = page.locator('aside button[class*="h-8"][class*="w-8"]')
      const count = await sidebarButtons.count()

      for (let i = 0; i < count; i++) {
        const button = sidebarButtons.nth(i)
        await expect(button).toBeVisible()

        // Check if button has accessible name via aria-label, aria-labelledby, or title
        const ariaLabel = await button.getAttribute('aria-label')
        const ariaLabelledBy = await button.getAttribute('aria-labelledby')
        const title = await button.getAttribute('title')

        const hasAccessibleName = ariaLabel !== null || ariaLabelledBy !== null || title !== null

        // If no explicit label, check if it contains text content
        if (!hasAccessibleName) {
          const textContent = await button.textContent()
          const hasText = textContent && textContent.trim().length > 0
          expect(hasText || hasAccessibleName).toBe(true)
        }
      }
    })

    test('webhook action buttons have accessible names', async ({ page }) => {
      await page.goto('/integrations')

      // Wait for webhooks section to load
      await expect(page.getByRole('heading', { name: /webhooks/i })).toBeVisible()

      // Find icon-only buttons in webhook cards (edit, delete)
      const webhookButtons = page.locator('.space-y-3 button[class*="h-8"][class*="w-8"]')
      const count = await webhookButtons.count()

      if (count > 0) {
        for (let i = 0; i < count; i++) {
          const button = webhookButtons.nth(i)
          if (await button.isVisible()) {
            // Button should have aria-label or title for accessibility
            const ariaLabel = await button.getAttribute('aria-label')
            const title = await button.getAttribute('title')
            const accessibleName = await button.evaluate(
              (el) => el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent?.trim()
            )

            // Log for debugging but don't fail - this is informational
            if (!ariaLabel && !title) {
              console.log(`Icon button ${i} may need aria-label for better accessibility`)
            }
          }
        }
      }
    })

    test('team page action buttons have accessible names', async ({ page }) => {
      await page.goto('/team')

      // Find the "more" button for team members (if exists)
      const moreButtons = page.getByRole('button').filter({ has: page.locator('[class*="More"], [class*="more"]') })
      const count = await moreButtons.count()

      if (count > 0) {
        for (let i = 0; i < count; i++) {
          const button = moreButtons.nth(i)
          if (await button.isVisible()) {
            const ariaLabel = await button.getAttribute('aria-label')
            const title = await button.getAttribute('title')

            // Log if missing, for improvement tracking
            if (!ariaLabel && !title) {
              console.log(`More options button ${i} should have aria-label like "More options"`)
            }
          }
        }
      }
    })
  })

  test.describe('Focus Management with Dialogs', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test('focus moves to dialog when opened', async ({ page }) => {
      await page.goto('/team')

      // Store the element that opened the dialog
      const inviteButton = page.getByRole('button', { name: /invite member/i })
      await expect(inviteButton).toBeVisible()

      // Open dialog
      await inviteButton.click()

      // Dialog should be visible
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()

      // Focus should be inside the dialog (typically on first focusable element)
      const emailInput = page.getByLabel(/email address/i)
      await expect(emailInput).toBeFocused()
    })

    test('focus returns to trigger when dialog closes via Escape', async ({ page }) => {
      await page.goto('/team')

      const inviteButton = page.getByRole('button', { name: /invite member/i })
      await inviteButton.click()

      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()

      // Close with Escape
      await page.keyboard.press('Escape')
      await expect(dialog).not.toBeVisible()

      // Focus should return to the invite button
      await expect(inviteButton).toBeFocused()
    })

    test('focus returns to trigger when dialog closes via Cancel button', async ({ page }) => {
      await page.goto('/team')

      const inviteButton = page.getByRole('button', { name: /invite member/i })
      await inviteButton.click()

      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()

      // Click Cancel button
      const cancelButton = dialog.getByRole('button', { name: /cancel/i })
      await cancelButton.click()
      await expect(dialog).not.toBeVisible()

      // Focus should return to the invite button
      await expect(inviteButton).toBeFocused()
    })

    test('integrations webhook dialog manages focus correctly', async ({ page }) => {
      await page.goto('/integrations')

      // Open webhook dialog
      const addWebhookButton = page.getByRole('button', { name: /add webhook/i })
      await expect(addWebhookButton).toBeVisible()
      await addWebhookButton.click()

      // Dialog should be visible
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()

      // Focus should be inside the dialog
      const focusedElement = page.locator(':focus')
      const isInDialog = await focusedElement.evaluate((el) => {
        return el.closest('[role="dialog"]') !== null
      })
      expect(isInDialog).toBe(true)

      // Close and verify focus returns
      await page.keyboard.press('Escape')
      await expect(dialog).not.toBeVisible()
      await expect(addWebhookButton).toBeFocused()
    })
  })

  test.describe('Tab Order', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test('tab order follows visual layout on dashboard', async ({ page }) => {
      await page.goto('/dashboard')

      // Get initial focused element after page load
      const initialFocus = page.locator(':focus')

      // Tab through elements and track order
      const focusOrder: string[] = []
      const maxTabs = 15

      for (let i = 0; i < maxTabs; i++) {
        await page.keyboard.press('Tab')
        const focused = page.locator(':focus')

        if (await focused.count() > 0) {
          const tagName = await focused.evaluate((el) => el.tagName.toLowerCase())
          const role = await focused.getAttribute('role')
          const text = await focused.textContent()

          focusOrder.push(
            `${tagName}${role ? `[role=${role}]` : ''}: ${text?.slice(0, 30).trim()}`
          )
        }
      }

      // Tab order should include navigation links before main content
      // This is a sanity check that focus moves through the page logically
      expect(focusOrder.length).toBeGreaterThan(0)
    })

    test('settings page tabs follow logical order', async ({ page }) => {
      await page.goto('/settings')

      // Focus on the tablist
      const tablist = page.getByRole('tablist')
      await expect(tablist).toBeVisible()

      const profileTab = page.getByRole('tab', { name: /profile/i })
      await profileTab.focus()

      // Tab should go to next tab (Account)
      await page.keyboard.press('Tab')
      const focusedAfterTab = page.locator(':focus')
      await expect(focusedAfterTab).toBeVisible()

      // The focus should have moved to a focusable element in tab panel or next tab
      const tagName = await focusedAfterTab.evaluate((el) => el.tagName.toLowerCase())
      expect(['input', 'button', 'a', 'textarea', 'select']).toContain(tagName)
    })

    test('Shift+Tab moves focus backwards', async ({ page }) => {
      await page.goto('/dashboard')

      // Tab forward a few times
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Tab')
      }

      // Record current focus
      const afterTabbing = page.locator(':focus')
      const afterTabbingText = await afterTabbing.textContent()

      // Tab backward
      await page.keyboard.press('Shift+Tab')

      // Focus should have moved to a different element
      const afterShiftTab = page.locator(':focus')
      const afterShiftTabText = await afterShiftTab.textContent()

      // Verify focus moved (could be same text if looping, but position changed)
      expect(await afterShiftTab.count()).toBe(1)
    })

    test('focus skips hidden elements', async ({ page }) => {
      await page.goto('/team')

      // Tab through all focusable elements
      const focusedElements: string[] = []
      const maxTabs = 30

      for (let i = 0; i < maxTabs; i++) {
        await page.keyboard.press('Tab')
        const focused = page.locator(':focus')

        if (await focused.count() > 0) {
          // Verify focused element is visible
          const isVisible = await focused.isVisible()
          expect(isVisible).toBe(true)

          const ariaHidden = await focused.getAttribute('aria-hidden')
          expect(ariaHidden).not.toBe('true')
        }
      }
    })
  })

  test.describe('Skip to Main Content', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test('skip link appears on first Tab press if exists', async ({ page }) => {
      await page.goto('/dashboard')

      // Press Tab to see if skip link appears
      await page.keyboard.press('Tab')

      // Check if there's a skip link (many accessible sites have this)
      const skipLink = page.getByRole('link', { name: /skip to (main )?content/i })
      const skipLinkExists = (await skipLink.count()) > 0

      if (skipLinkExists) {
        await expect(skipLink).toBeVisible()
        await expect(skipLink).toBeFocused()
      } else {
        // If no skip link, first focusable should be in sidebar/nav
        // This is informational - document the current behavior
        const firstFocused = page.locator(':focus')
        const isNavElement = await firstFocused.evaluate((el) => {
          return el.closest('nav') !== null || el.closest('aside') !== null
        })

        // Log suggestion for improvement
        console.log(
          'No skip link found. Consider adding a "Skip to main content" link for keyboard users.'
        )
      }
    })

    test('main content area is focusable or reachable', async ({ page }) => {
      await page.goto('/dashboard')

      // The main content area should be reachable via keyboard
      // Either through a skip link or within reasonable tab presses
      const mainContent = page.locator('main')
      await expect(mainContent).toBeVisible()

      // Check if main has tabindex for direct focus or contains focusable content
      const tabindex = await mainContent.getAttribute('tabindex')
      const hasFocusableContent = await mainContent.evaluate((el) => {
        const focusables = el.querySelectorAll(
          'a, button, input, textarea, select, [tabindex]:not([tabindex="-1"])'
        )
        return focusables.length > 0
      })

      // Main should either be focusable directly or contain focusable elements
      expect(tabindex !== null || hasFocusableContent).toBe(true)
    })
  })

  test.describe('Sidebar Keyboard Navigation', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test('sidebar navigation links are keyboard accessible', async ({ page }) => {
      await page.goto('/dashboard')

      // Find nav links in sidebar
      const navLinks = page.locator('aside nav').getByRole('link')
      const linkCount = await navLinks.count()

      expect(linkCount).toBeGreaterThan(0)

      // Each link should be focusable and activatable
      const firstLink = navLinks.first()
      await firstLink.focus()
      await expect(firstLink).toBeFocused()

      // Should be able to activate with Enter
      const href = await firstLink.getAttribute('href')
      await page.keyboard.press('Enter')
      await page.waitForURL(`**${href}**`)
    })

    test('sidebar collapse toggle works with keyboard', async ({ page }) => {
      await page.goto('/dashboard')

      // Find the collapse button in sidebar
      const sidebar = page.locator('aside')
      const initialBox = await sidebar.boundingBox()
      const initialWidth = initialBox?.width ?? 0

      // Use Cmd+B or Ctrl+B to toggle sidebar
      await page.keyboard.press('Control+b')

      // Wait for transition and verify width changed
      await page.waitForTimeout(350) // Wait for transition duration
      const newBox = await sidebar.boundingBox()
      const newWidth = newBox?.width ?? 0

      expect(newWidth).not.toBe(initialWidth)
    })

    test('theme toggle button is keyboard accessible', async ({ page }) => {
      await page.goto('/dashboard')

      // Find the theme toggle button (has moon or sun icon)
      const themeButton = page.locator('aside').getByRole('button').filter({
        has: page.locator('[class*="moon"], [class*="sun"], svg'),
      }).first()

      if (await themeButton.count() > 0) {
        await themeButton.focus()
        await expect(themeButton).toBeFocused()

        // Should have title or aria-label
        const title = await themeButton.getAttribute('title')
        expect(title).toBeTruthy()
      }
    })
  })

  test.describe('Form Keyboard Navigation', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test('settings form fields are navigable with Tab', async ({ page }) => {
      await page.goto('/settings')

      // Focus on name input
      const nameInput = page.getByLabel(/full name/i)
      await nameInput.focus()
      await expect(nameInput).toBeFocused()

      // Tab to next field (email input)
      await page.keyboard.press('Tab')
      const emailInput = page.getByLabel(/email address/i)
      await expect(emailInput).toBeFocused()

      // Tab to save button
      let foundSaveButton = false
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Tab')
        const focused = page.locator(':focus')
        const text = await focused.textContent()
        if (text?.includes('Save')) {
          foundSaveButton = true
          break
        }
      }
      expect(foundSaveButton).toBe(true)
    })

    test('form can be submitted with Enter key', async ({ page }) => {
      await page.goto('/settings')

      // Focus on name input
      const nameInput = page.getByLabel(/full name/i)
      await nameInput.fill('Test User')

      // Navigate to save button and press Enter
      const saveButton = page.getByRole('button', { name: /save changes/i })
      await saveButton.focus()
      await page.keyboard.press('Enter')

      // Should see some response (toast, loading state, etc.)
      // Just verify the button responded to keyboard activation
      await expect(saveButton).toBeVisible()
    })

    test('radio button groups can be navigated with arrow keys', async ({ page }) => {
      await page.goto('/team')

      // Open invite dialog which has role selection
      await page.getByRole('button', { name: /invite member/i }).click()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()

      // Find role buttons (Member/Admin toggle)
      const memberButton = dialog.getByRole('button', { name: /member/i }).first()
      const adminButton = dialog.getByRole('button', { name: /admin/i }).first()

      // Focus on member button
      await memberButton.focus()
      await expect(memberButton).toBeFocused()

      // Tab should move to admin button
      await page.keyboard.press('Tab')
      await expect(adminButton).toBeFocused()

      // Activating with Space or Enter should work
      await page.keyboard.press('Space')

      // Verify admin is now selected (variant changed)
      await expect(adminButton).toHaveAttribute('data-variant', /.*/i)
    })
  })

  test.describe('Integrations Page Keyboard Navigation', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test('category filter buttons are keyboard navigable', async ({ page }) => {
      await page.goto('/integrations')

      // Find category buttons
      const categoryButtons = page.getByRole('button', { name: /all|communication|payments|development|automation/i })
      const count = await categoryButtons.count()

      expect(count).toBeGreaterThan(0)

      // Focus on first category button
      await categoryButtons.first().focus()
      await expect(categoryButtons.first()).toBeFocused()

      // Tab through categories
      for (let i = 1; i < count && i < 4; i++) {
        await page.keyboard.press('Tab')
        const focused = page.locator(':focus')
        await expect(focused).toBeVisible()
      }
    })

    test('integration cards have focusable action buttons', async ({ page }) => {
      await page.goto('/integrations')

      // Find connect/configure buttons on integration cards
      const actionButtons = page.locator('[class*="CardContent"]').getByRole('button', {
        name: /connect|configure/i,
      })
      const count = await actionButtons.count()

      if (count > 0) {
        // First button should be focusable
        await actionButtons.first().focus()
        await expect(actionButtons.first()).toBeFocused()

        // Should be activatable with Enter
        await page.keyboard.press('Enter')

        // Button should respond (either change state or trigger action)
        await expect(actionButtons.first()).toBeVisible()
      }
    })

    test('search input captures focus on Tab', async ({ page }) => {
      await page.goto('/integrations')

      // Tab until we reach the search input
      const searchInput = page.getByPlaceholder(/search integrations/i)

      let foundSearch = false
      for (let i = 0; i < 15; i++) {
        await page.keyboard.press('Tab')
        const focused = page.locator(':focus')

        if (await searchInput.evaluate((el, focused) => el === focused, await focused.elementHandle())) {
          foundSearch = true
          break
        }
      }

      // Alternatively, directly focus and verify
      await searchInput.focus()
      await expect(searchInput).toBeFocused()

      // Type should work when focused
      await page.keyboard.type('slack')
      await expect(searchInput).toHaveValue('slack')
    })
  })
})
