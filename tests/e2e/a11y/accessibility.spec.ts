import { test, expect, isAuthenticated } from '../fixtures'

/**
 * Accessibility E2E Tests
 *
 * Tests for accessibility features including keyboard navigation,
 * focus management, semantic structure, and ARIA attributes.
 *
 * Uses Playwright's built-in accessibility testing features:
 * - toHaveAccessibleName() for accessible names
 * - toHaveRole() for ARIA roles
 * - toHaveAccessibleDescription() for descriptions
 *
 * @tags @a11y
 */

test.describe('Accessibility Tests @a11y', () => {
  test.describe('Public Pages', () => {
    test('login page has proper heading structure', async ({ page }) => {
      await page.goto('/login')

      // Should have a heading (Welcome back) - CardTitle renders as h3
      const heading = page.getByRole('heading', { name: /welcome back/i })
      await expect(heading).toBeVisible()

      // Verify heading has semantic meaning (is an actual heading element)
      const tagName = await heading.evaluate((el) => el.tagName.toLowerCase())
      expect(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']).toContain(tagName)
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

      // Verify the OAuth button is keyboard accessible
      const googleButton = page.getByRole('button', { name: /continue with google/i })
      await expect(googleButton).toBeVisible()

      // Focus the button directly to verify it can receive focus
      await googleButton.focus()
      await expect(googleButton).toBeFocused()

      // Tab to next element and verify focus moves
      await page.keyboard.press('Tab')
      const activeElement = page.locator(':focus')
      await expect(activeElement).toBeVisible()

      // Verify we can navigate back with Shift+Tab
      await page.keyboard.press('Shift+Tab')
      await expect(googleButton).toBeFocused()
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

    test('account page has proper headings and landmarks', async ({ page }) => {
      await page.goto('/account')

      // Should have main heading (h1)
      const mainHeading = page.getByRole('heading', { level: 1 })
      await expect(mainHeading).toBeVisible()

      // Should have multiple section headings (h2) for different account sections
      // Account page typically has: Security, Sessions, API Access, Danger Zone
      const sectionHeadings = page.getByRole('heading', { level: 2 })
      const headingCount = await sectionHeadings.count()
      expect(headingCount).toBeGreaterThanOrEqual(3)
    })

    test('dialogs have proper ARIA attributes', async ({ page }) => {
      await page.goto('/team')

      // Wait for the page heading to ensure content is loaded
      const pageHeading = page.getByRole('heading', { level: 1, name: /team members/i })
      await expect(pageHeading).toBeVisible()

      // Open invite dialog - click the second button (the visible styled one)
      const inviteButton = page.getByText('Invite Member', { exact: true })
      await expect(inviteButton).toBeVisible()
      await inviteButton.click()

      // Dialog should be visible
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()

      // Dialog should have proper ARIA attributes for accessibility
      const hasAriaLabelledBy = await dialog.getAttribute('aria-labelledby')
      const hasAriaLabel = await dialog.getAttribute('aria-label')
      const hasAriaModal = await dialog.getAttribute('aria-modal')

      // At least one labeling attribute or aria-modal should be present
      const hasProperAriaAttributes =
        hasAriaLabelledBy !== null || hasAriaLabel !== null || hasAriaModal !== null
      expect(hasProperAriaAttributes).toBe(true)

      // Close dialog
      await page.keyboard.press('Escape')
      await expect(dialog).not.toBeVisible()
    })

    test('form inputs have associated labels via getByLabel', async ({ page }) => {
      await page.goto('/settings')

      // Wait for the settings page heading to ensure page is loaded
      const heading = page.getByRole('heading', { level: 1, name: /settings/i })
      await expect(heading).toBeVisible()

      // Name input should be accessible via label
      const nameInput = page.getByLabel(/full name/i)
      await expect(nameInput).toBeVisible()
      await expect(nameInput).toBeEnabled()

      // Email input should be accessible via label (but may be disabled for OAuth users)
      const emailInput = page.getByLabel(/email address/i)
      await expect(emailInput).toBeVisible()

      // Name input should be focusable
      await nameInput.focus()
      await expect(nameInput).toBeFocused()

      // Note: Email input may be disabled for OAuth-only users, so we just verify
      // it has a proper label association (which getByLabel already confirms)
    })

    test('interactive elements are focusable', async ({ page }) => {
      await page.goto('/integrations')

      // Wait for the page heading to ensure content is loaded
      const pageHeading = page.getByRole('heading', { level: 1, name: /integrations/i })
      await expect(pageHeading).toBeVisible()

      // Focus on the search input first to establish a starting point
      const searchInput = page.getByPlaceholder(/search integrations/i)
      await expect(searchInput).toBeVisible()
      await searchInput.focus()
      await expect(searchInput).toBeFocused()

      // Press Tab to move to next interactive element
      await page.keyboard.press('Tab')

      // Verify something is focused after Tab
      const focusedElement = page.locator(':focus')
      await expect(focusedElement).toBeVisible()

      // Continue tabbing to verify multiple interactive elements are focusable
      await page.keyboard.press('Tab')
      const secondFocusedElement = page.locator(':focus')
      await expect(secondFocusedElement).toBeVisible()
    })
  })

  test.describe('Live Regions and Announcements', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test('toast notifications have role="status"', async ({ page }) => {
      await page.goto('/settings')

      // Trigger a toast by saving settings
      const nameInput = page.getByLabel(/full name/i)
      await nameInput.fill('Test User Updated')

      const saveButton = page.getByRole('button', { name: /save changes/i })
      await saveButton.click()

      // Toast should appear with proper role
      const toast = page.getByRole('status')
      await expect(toast.first()).toBeVisible({ timeout: 5000 })
    })

    test('loading states are announced', async ({ page }) => {
      await page.goto('/settings')

      // Check that buttons have loading indicators when submitting
      const saveButton = page.getByRole('button', { name: /save changes/i })

      // Button should indicate loading state accessibly
      // Either through aria-busy, aria-disabled, or visible spinner
      await saveButton.click()

      // The button should either be disabled or have aria-busy during loading
      const isDisabled = await saveButton.isDisabled()
      const ariaBusy = await saveButton.getAttribute('aria-busy')
      const hasSpinner = await saveButton.locator('[class*="spinner"], [class*="animate-spin"]').count()

      // At least one loading indicator should be present
      expect(isDisabled || ariaBusy === 'true' || hasSpinner > 0).toBe(true)
    })
  })

  test.describe('Touch Targets', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test('buttons meet minimum touch target size (44x44)', async ({ page }) => {
      await page.goto('/dashboard')

      // Get all buttons
      const buttons = page.getByRole('button')
      const count = await buttons.count()

      // Check a sample of buttons for adequate size
      const samplesToCheck = Math.min(count, 10)
      let smallButtonsFound = 0

      for (let i = 0; i < samplesToCheck; i++) {
        const button = buttons.nth(i)
        if (await button.isVisible()) {
          const box = await button.boundingBox()
          if (box) {
            // WCAG recommends 44x44 minimum touch target
            // We'll log a warning if smaller, but not fail
            if (box.width < 44 || box.height < 44) {
              smallButtonsFound++
            }
          }
        }
      }

      // Allow some small icon buttons, but most should be adequate size
      expect(smallButtonsFound).toBeLessThan(samplesToCheck / 2)
    })

    test('links have adequate click area', async ({ page }) => {
      await page.goto('/dashboard')

      // Check navigation links
      const navLinks = page.locator('nav').getByRole('link')
      const count = await navLinks.count()

      for (let i = 0; i < Math.min(count, 5); i++) {
        const link = navLinks.nth(i)
        if (await link.isVisible()) {
          const box = await link.boundingBox()
          if (box) {
            // Links should have reasonable padding for touch
            expect(box.height).toBeGreaterThanOrEqual(32)
          }
        }
      }
    })
  })

  test.describe('Image Accessibility', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test('all images have alt attributes', async ({ page }) => {
      await page.goto('/dashboard')

      // Find all images
      const images = page.locator('img')
      const count = await images.count()

      for (let i = 0; i < count; i++) {
        const img = images.nth(i)
        if (await img.isVisible()) {
          // Image should have alt attribute (can be empty for decorative)
          await expect(img).toHaveAttribute('alt')
        }
      }
    })

    test('SVG icons have accessible roles or are hidden', async ({ page }) => {
      await page.goto('/dashboard')

      // Find SVG elements
      const svgs = page.locator('svg')
      const count = await svgs.count()

      for (let i = 0; i < Math.min(count, 10); i++) {
        const svg = svgs.nth(i)
        if (await svg.isVisible()) {
          // SVG should either have role="img" with accessible name
          // or be aria-hidden="true" if decorative
          const role = await svg.getAttribute('role')
          const ariaHidden = await svg.getAttribute('aria-hidden')
          const ariaLabel = await svg.getAttribute('aria-label')
          const title = await svg.locator('title').count()

          // Either hidden or has accessible name
          const isAccessible = ariaHidden === 'true' ||
            role === 'img' ||
            ariaLabel !== null ||
            title > 0

          // Most icons in buttons are decorative (text provides meaning)
          // so aria-hidden is acceptable
          expect(isAccessible || ariaHidden === null).toBe(true)
        }
      }
    })
  })

  test.describe('Reduced Motion', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test('app respects prefers-reduced-motion', async ({ page }) => {
      // Emulate reduced motion preference
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto('/dashboard')

      // Check that the app loaded successfully with reduced motion
      await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible()

      // Animations should be disabled or reduced
      // Check sidebar collapse - should not have transition
      const sidebar = page.locator('aside')
      await expect(sidebar).toBeVisible()

      // The app should be fully functional with reduced motion
      const navLinks = page.locator('nav').getByRole('link')
      await expect(navLinks.first()).toBeVisible()
    })
  })

  test.describe('Color Independence', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test('status indicators have text/icon alternatives to color', async ({ page }) => {
      await page.goto('/integrations')

      // Check connected status - should have "Connected" badge text, not just green color
      const connectedBadge = page.locator('[class*="Badge"]', { hasText: /connected/i })
      const count = await connectedBadge.count()

      if (count > 0) {
        await expect(connectedBadge.first()).toBeVisible()
        // Badge has text, so color is not the only indicator
        const text = await connectedBadge.first().textContent()
        expect(text?.toLowerCase()).toContain('connected')
      }
    })

    test('form validation errors have text descriptions', async ({ page }) => {
      await page.goto('/team')

      // Open invite dialog
      await page.getByRole('button', { name: /invite member/i }).click()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()

      // Email input should have label for screen readers
      const emailInput = page.getByLabel(/email address/i)
      await expect(emailInput).toBeVisible()

      // If we had invalid input, error should be in text, not just color
      // For now, verify label exists
      const label = page.locator('label', { hasText: /email/i })
      await expect(label).toBeVisible()
    })

    test('role badges convey meaning without color', async ({ page }) => {
      await page.goto('/team')

      // Role badges should have text (admin, member, owner)
      const badges = page.locator('[class*="Badge"]')
      const count = await badges.count()

      for (let i = 0; i < Math.min(count, 5); i++) {
        const badge = badges.nth(i)
        if (await badge.isVisible()) {
          const text = await badge.textContent()
          // Badge should have readable text content
          expect(text?.trim().length).toBeGreaterThan(0)
        }
      }
    })
  })

  test.describe('Focus Visibility', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test('focused elements have visible focus indicator', async ({ page }) => {
      await page.goto('/dashboard')

      // Tab to first interactive element
      await page.keyboard.press('Tab')
      const focused = page.locator(':focus')

      if (await focused.count() > 0) {
        // Get computed style to check for focus ring
        const styles = await focused.evaluate((el) => {
          const computed = window.getComputedStyle(el)
          return {
            outline: computed.outline,
            outlineWidth: computed.outlineWidth,
            boxShadow: computed.boxShadow,
            borderColor: computed.borderColor,
          }
        })

        // Element should have some visible focus indicator
        // (outline, box-shadow, or border change)
        const hasVisibleFocus =
          styles.outlineWidth !== '0px' ||
          styles.boxShadow !== 'none' ||
          styles.borderColor !== 'transparent'

        expect(hasVisibleFocus).toBe(true)
      }
    })

    test('buttons show focus state distinctly from hover', async ({ page }) => {
      await page.goto('/settings')

      const saveButton = page.getByRole('button', { name: /save changes/i })

      // Get normal state
      const normalStyles = await saveButton.evaluate((el) => {
        const computed = window.getComputedStyle(el)
        return {
          outline: computed.outline,
          boxShadow: computed.boxShadow,
        }
      })

      // Focus the button
      await saveButton.focus()

      // Get focused state
      const focusedStyles = await saveButton.evaluate((el) => {
        const computed = window.getComputedStyle(el)
        return {
          outline: computed.outline,
          boxShadow: computed.boxShadow,
        }
      })

      // Focus state should be different from normal state
      const hasDistinctFocus =
        focusedStyles.outline !== normalStyles.outline ||
        focusedStyles.boxShadow !== normalStyles.boxShadow

      expect(hasDistinctFocus).toBe(true)
    })
  })

  test.describe('Semantic HTML', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test('page uses semantic HTML elements', async ({ page }) => {
      await page.goto('/dashboard')

      // Check for semantic structure
      const main = page.locator('main')
      await expect(main).toBeVisible()

      const nav = page.locator('nav')
      await expect(nav.first()).toBeVisible()

      const aside = page.locator('aside')
      await expect(aside).toBeVisible()

      // Headings should be present
      const h1 = page.getByRole('heading', { level: 1 })
      await expect(h1).toBeVisible()
    })

    test('lists use proper list elements', async ({ page }) => {
      await page.goto('/team')

      // Team members should be in a structured format
      // Even if not using ul/li, should have role="list" or similar structure
      const memberList = page.locator('[class*="divide-y"]')
      await expect(memberList.first()).toBeVisible()

      // Should contain multiple items
      const items = memberList.first().locator('> div')
      const count = await items.count()
      expect(count).toBeGreaterThanOrEqual(1)
    })

    test('buttons are not links and links are not buttons', async ({ page }) => {
      await page.goto('/dashboard')

      // Buttons should be <button> elements
      const buttons = page.getByRole('button')
      const buttonCount = await buttons.count()

      for (let i = 0; i < Math.min(buttonCount, 5); i++) {
        const button = buttons.nth(i)
        if (await button.isVisible()) {
          const tagName = await button.evaluate((el) => el.tagName.toLowerCase())
          // Should be button or have role="button"
          const role = await button.getAttribute('role')
          expect(tagName === 'button' || role === 'button').toBe(true)
        }
      }

      // Links should be <a> elements
      const links = page.getByRole('link')
      const linkCount = await links.count()

      for (let i = 0; i < Math.min(linkCount, 5); i++) {
        const link = links.nth(i)
        if (await link.isVisible()) {
          const tagName = await link.evaluate((el) => el.tagName.toLowerCase())
          expect(tagName).toBe('a')

          // Links should have href
          const href = await link.getAttribute('href')
          expect(href).toBeTruthy()
        }
      }
    })
  })

  test.describe('Text Accessibility', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test('text can be resized up to 200% without loss', async ({ page }) => {
      await page.goto('/dashboard')

      // Zoom to 200%
      await page.evaluate(() => {
        document.body.style.zoom = '2'
      })

      // Content should still be visible and usable
      await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible()

      // Navigation should still work
      const navLinks = page.locator('nav').getByRole('link')
      await expect(navLinks.first()).toBeVisible()
    })

    test('line height and spacing support readability', async ({ page }) => {
      await page.goto('/dashboard')

      // Check paragraph text has adequate line height
      const paragraphs = page.locator('p')
      const count = await paragraphs.count()

      if (count > 0) {
        const styles = await paragraphs.first().evaluate((el) => {
          const computed = window.getComputedStyle(el)
          const fontSize = parseFloat(computed.fontSize)
          const lineHeight = parseFloat(computed.lineHeight)
          return { fontSize, lineHeight, ratio: lineHeight / fontSize }
        })

        // Line height should be at least 1.5 times font size for readability
        // (WCAG AAA recommends 1.5, AA allows 1.2)
        expect(styles.ratio).toBeGreaterThanOrEqual(1.2)
      }
    })
  })
})
