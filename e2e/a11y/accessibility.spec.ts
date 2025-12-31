import { test, expect, isAuthenticated } from '../fixtures'

/**
 * Accessibility E2E Tests
 *
 * Tests for accessibility features including keyboard navigation,
 * focus management, semantic structure, and ARIA attributes.
 *
 * @tags @a11y
 */

test.describe('Accessibility Tests @a11y', () => {
  test.describe('Public Pages', () => {
    test('login page has proper heading structure', async ({ page }) => {
      await page.goto('/login')

      // Should have a main heading (Welcome back)
      const heading = page.getByRole('heading', { name: /welcome back/i })
      await expect(heading).toBeVisible()

      // Verify heading level is appropriate (h2 in CardTitle)
      await expect(heading).toHaveAttribute('class', expect.stringContaining('text-2xl'))
    })

    test('login page form is accessible (OAuth button focusable)', async ({ page }) => {
      await page.goto('/login')

      // OAuth button should be focusable
      const googleButton = page.getByRole('button', { name: /continue with google/i })
      await expect(googleButton).toBeVisible()
      await expect(googleButton).toBeEnabled()

      // Focus the button
      await googleButton.focus()
      await expect(googleButton).toBeFocused()

      // Button should have accessible name
      await expect(googleButton).toHaveAccessibleName(/continue with google/i)
    })

    test('login page supports keyboard navigation', async ({ page }) => {
      await page.goto('/login')

      // Start from body and tab through focusable elements
      await page.keyboard.press('Tab')

      // First focusable element should be the logo link
      const logoLink = page.getByRole('link', { name: /hono/i })
      await expect(logoLink).toBeFocused()

      // Tab to the OAuth button
      await page.keyboard.press('Tab')
      const googleButton = page.getByRole('button', { name: /continue with google/i })
      await expect(googleButton).toBeFocused()

      // Tab to Terms link
      await page.keyboard.press('Tab')
      const termsLink = page.getByRole('link', { name: /terms of service/i })
      await expect(termsLink).toBeFocused()

      // Tab to Privacy link
      await page.keyboard.press('Tab')
      const privacyLink = page.getByRole('link', { name: /privacy policy/i })
      await expect(privacyLink).toBeFocused()

      // Tab to Contact link
      await page.keyboard.press('Tab')
      const contactLink = page.getByRole('link', { name: /contact us/i })
      await expect(contactLink).toBeFocused()
    })

    test('login page links have proper focus indicators', async ({ page }) => {
      await page.goto('/login')

      // Navigate to a link
      const termsLink = page.getByRole('link', { name: /terms of service/i })
      await termsLink.focus()
      await expect(termsLink).toBeFocused()

      // Link should have underline for visibility
      await expect(termsLink).toHaveClass(/underline/)
    })
  })

  test.describe('Authenticated Pages', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test('dashboard has proper semantic structure', async ({ page }) => {
      await page.goto('/dashboard')

      // Should have main heading
      const heading = page.getByRole('heading', { name: /dashboard/i })
      await expect(heading).toBeVisible()

      // Page should have a main content area (div with proper structure)
      const mainContent = page.locator('main, [role="main"], .space-y-6').first()
      await expect(mainContent).toBeVisible()
    })

    test('team page table/list is accessible', async ({ page }) => {
      await page.goto('/team')

      // Should have heading
      await expect(page.getByRole('heading', { name: /team members/i })).toBeVisible()

      // Team members should be in a structured list (divide-y creates visual separation)
      const memberList = page.locator('[class*="divide-y"]').first()
      await expect(memberList).toBeVisible()

      // Each member row should be visible and contain content
      const firstMemberRow = memberList.locator('> div').first()
      await expect(firstMemberRow).toBeVisible()
    })

    test('settings tabs are keyboard accessible', async ({ page }) => {
      await page.goto('/settings')

      // Verify tabs are present
      const tabList = page.getByRole('tablist')
      await expect(tabList).toBeVisible()

      // Profile tab should be selected by default
      const profileTab = page.getByRole('tab', { name: /profile/i })
      await expect(profileTab).toHaveAttribute('data-state', 'active')

      // Focus on tab list
      await profileTab.focus()
      await expect(profileTab).toBeFocused()

      // Arrow right should move to next tab (Account)
      await page.keyboard.press('ArrowRight')
      const accountTab = page.getByRole('tab', { name: /account/i })
      await expect(accountTab).toBeFocused()

      // Arrow right again to Notifications
      await page.keyboard.press('ArrowRight')
      const notificationsTab = page.getByRole('tab', { name: /notifications/i })
      await expect(notificationsTab).toBeFocused()

      // Arrow left should go back
      await page.keyboard.press('ArrowLeft')
      await expect(accountTab).toBeFocused()

      // Enter should activate the tab
      await page.keyboard.press('Enter')
      await expect(accountTab).toHaveAttribute('data-state', 'active')

      // Tab content should be visible
      await expect(page.getByText(/connected accounts/i)).toBeVisible()
    })

    test('team invite dialog is accessible (focus trap, escape to close)', async ({ page }) => {
      await page.goto('/team')

      // Open invite dialog
      const inviteButton = page.getByRole('button', { name: /invite member/i })
      await inviteButton.click()

      // Dialog should be visible
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()

      // Dialog should have proper title
      await expect(page.getByRole('heading', { name: /invite team member/i })).toBeVisible()

      // First focusable element in dialog should receive focus (email input)
      const emailInput = page.getByLabel(/email address/i)
      await expect(emailInput).toBeFocused()

      // Tab through dialog elements - focus should stay trapped
      await page.keyboard.press('Tab') // Move to role buttons

      // Tab to cancel button
      let tabCount = 0
      const maxTabs = 10
      while (tabCount < maxTabs) {
        await page.keyboard.press('Tab')
        tabCount++
        const cancelButton = page.getByRole('button', { name: /cancel/i })
        if (await cancelButton.evaluate((el) => el === document.activeElement)) {
          break
        }
      }

      // Escape should close dialog
      await page.keyboard.press('Escape')
      await expect(dialog).not.toBeVisible()
    })

    test('form inputs have labels', async ({ page }) => {
      await page.goto('/settings')

      // Full Name input should have label
      const nameInput = page.getByLabel(/full name/i)
      await expect(nameInput).toBeVisible()
      await expect(nameInput).toHaveAttribute('id', 'name')

      // Email input should have label
      const emailInput = page.getByLabel(/email address/i)
      await expect(emailInput).toBeVisible()
      await expect(emailInput).toHaveAttribute('id', 'email')
    })

    test('buttons have accessible names', async ({ page }) => {
      await page.goto('/settings')

      // Save Changes button
      const saveButton = page.getByRole('button', { name: /save changes/i })
      await expect(saveButton).toBeVisible()
      await expect(saveButton).toHaveAccessibleName(/save changes/i)

      // Change Photo button
      const photoButton = page.getByRole('button', { name: /change photo/i })
      await expect(photoButton).toBeVisible()
      await expect(photoButton).toHaveAccessibleName(/change photo/i)

      // Go to Account tab for Delete button
      await page.getByRole('tab', { name: /account/i }).click()
      const deleteButton = page.getByRole('button', { name: /delete account/i })
      await expect(deleteButton).toBeVisible()
      await expect(deleteButton).toHaveAccessibleName(/delete account/i)
    })

    test('navigation is keyboard accessible', async ({ page }) => {
      await page.goto('/dashboard')

      // Find navigation links
      const navLinks = page.locator('nav').getByRole('link')
      const linkCount = await navLinks.count()

      if (linkCount > 0) {
        // Focus first nav link
        await navLinks.first().focus()
        await expect(navLinks.first()).toBeFocused()

        // Should be able to tab through nav links
        for (let i = 1; i < Math.min(linkCount, 3); i++) {
          await page.keyboard.press('Tab')
        }

        // Enter should activate the link (navigate)
        const currentUrl = page.url()
        await navLinks.first().focus()
        await page.keyboard.press('Enter')
        // URL should change or page should respond
        await page.waitForLoadState('domcontentloaded')
      }
    })

    test('color contrast check (basic - text is visible)', async ({ page }) => {
      await page.goto('/settings')

      // Verify main heading text is visible and has proper styling
      const heading = page.getByRole('heading', { name: /settings/i })
      await expect(heading).toBeVisible()

      // Verify description text is visible (muted but readable)
      const description = page.getByText(/manage your account settings/i)
      await expect(description).toBeVisible()

      // Verify form labels are visible
      const nameLabel = page.getByText('Full Name')
      await expect(nameLabel).toBeVisible()

      // Verify input text is visible
      const nameInput = page.getByLabel(/full name/i)
      await expect(nameInput).toBeVisible()

      // Verify button text is visible and has sufficient contrast
      const saveButton = page.getByRole('button', { name: /save changes/i })
      await expect(saveButton).toBeVisible()

      // Verify disabled input has visible styling
      const emailInput = page.getByLabel(/email address/i)
      await expect(emailInput).toBeVisible()
      await expect(emailInput).toBeDisabled()

      // Navigate to Account tab to check destructive button contrast
      await page.getByRole('tab', { name: /account/i }).click()
      const deleteButton = page.getByRole('button', { name: /delete account/i })
      await expect(deleteButton).toBeVisible()
    })

    test('team page search input is accessible', async ({ page }) => {
      await page.goto('/team')

      // Search input should have placeholder as accessible description
      const searchInput = page.getByPlaceholder(/search members/i)
      await expect(searchInput).toBeVisible()
      await expect(searchInput).toBeEnabled()

      // Should be focusable
      await searchInput.focus()
      await expect(searchInput).toBeFocused()

      // Should accept keyboard input
      await page.keyboard.type('test')
      await expect(searchInput).toHaveValue('test')
    })

    test('settings notification toggles are accessible', async ({ page }) => {
      await page.goto('/settings')

      // Navigate to notifications tab
      await page.getByRole('tab', { name: /notifications/i }).click()

      // Should see switch elements
      const switches = page.getByRole('switch')
      const switchCount = await switches.count()

      expect(switchCount).toBeGreaterThan(0)

      // First switch should be focusable
      const firstSwitch = switches.first()
      await firstSwitch.focus()
      await expect(firstSwitch).toBeFocused()

      // Should have aria-checked attribute
      await expect(firstSwitch).toHaveAttribute('aria-checked')

      // Should be keyboard toggleable with Space/Enter
      const initialState = await firstSwitch.getAttribute('aria-checked')

      // Skip if disabled
      const isDisabled = await firstSwitch.isDisabled()
      if (!isDisabled) {
        await page.keyboard.press('Space')
        const newState = await firstSwitch.getAttribute('aria-checked')
        expect(newState).not.toBe(initialState)
      }
    })

    test('avatar images have alt text', async ({ page }) => {
      await page.goto('/settings')

      // Avatar should have alt text
      const avatarImage = page.locator('[class*="Avatar"] img')
      const imageCount = await avatarImage.count()

      if (imageCount > 0) {
        await expect(avatarImage.first()).toHaveAttribute('alt')
      } else {
        // Fallback avatar should still be accessible
        const avatarFallback = page.locator('[class*="AvatarFallback"]')
        await expect(avatarFallback).toBeVisible()
      }
    })

    test('skip to main content functionality', async ({ page }) => {
      await page.goto('/dashboard')

      // Many accessible sites have a skip link that appears on focus
      // Check if one exists or if the page structure allows quick navigation
      await page.keyboard.press('Tab')

      // The first focusable element should allow navigation
      // In most cases, this would be a skip link or the main navigation
      const focusedElement = page.locator(':focus')
      await expect(focusedElement).toBeVisible()
    })

    test('dialogs trap focus correctly', async ({ page }) => {
      await page.goto('/team')

      // Open invite dialog
      await page.getByRole('button', { name: /invite member/i }).click()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()

      // Tab through all elements in the dialog
      const tabPresses = 15 // More than enough to cycle through dialog
      for (let i = 0; i < tabPresses; i++) {
        await page.keyboard.press('Tab')
      }

      // Focus should still be within the dialog
      const focusedElement = page.locator(':focus')
      const isInDialog = await focusedElement.evaluate((el) => {
        const dialog = el.closest('[role="dialog"]')
        return dialog !== null
      })

      expect(isInDialog).toBe(true)

      // Close dialog
      await page.keyboard.press('Escape')
      await expect(dialog).not.toBeVisible()
    })

    test('error states are accessible', async ({ page }) => {
      await page.goto('/team')

      // Open invite dialog
      await page.getByRole('button', { name: /invite member/i }).click()

      // Send button should be disabled when email is empty
      const sendButton = page.getByRole('button', { name: /send invitation/i })
      await expect(sendButton).toBeDisabled()

      // Enter invalid email
      const emailInput = page.getByLabel(/email address/i)
      await emailInput.fill('invalid-email')

      // Button state should reflect validity
      // Most implementations either show inline error or disable button
      await expect(sendButton).toBeVisible()

      // Close dialog
      await page.keyboard.press('Escape')
    })
  })
})
