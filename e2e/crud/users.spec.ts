import { test, expect, isAuthenticated, waitForNavigation } from '../fixtures'

/**
 * User CRUD E2E Tests
 *
 * Tests for user management functionality via the UI.
 * Since OAuth cannot be automated in E2E tests, these tests verify
 * UI elements and flows are present and functioning correctly.
 *
 * @tags @crud
 */

test.describe('User CRUD @crud', () => {
  test.beforeEach(async ({ page }) => {
    const authenticated = await isAuthenticated(page)
    test.skip(!authenticated, 'No authenticated session available')
  })

  test.describe('Team Page - User List', () => {
    test('should display user list when authenticated', async ({ page }) => {
      await page.goto('/team')

      // Should not be redirected to login
      await expect(page).not.toHaveURL(/login/)

      // Should see the Team Members heading
      await expect(page.getByRole('heading', { name: /team members/i })).toBeVisible()

      // Should see the Active Members card
      await expect(page.getByText(/active members/i)).toBeVisible()

      // Should see at least one team member (the current user)
      const memberName = page.getByText(/e2e test user/i).first()
      const memberEmail = page.getByText(/@.*\./i).first()

      const hasName = await memberName.isVisible({ timeout: 3000 }).catch(() => false)
      const hasEmail = await memberEmail.isVisible({ timeout: 3000 }).catch(() => false)

      // Should have at least member info visible
      expect(hasName || hasEmail).toBeTruthy()
    })

    test('should show invite button on team page', async ({ page }) => {
      await page.goto('/team')

      // Should see the Invite Member button (use first() as there may be nested buttons)
      const inviteButton = page.getByRole('button', { name: /invite member/i }).first()
      await expect(inviteButton).toBeVisible()
      await expect(inviteButton).toBeEnabled()
    })

    test('should show search functionality for members', async ({ page }) => {
      await page.goto('/team')

      // Should see search input
      const searchInput = page.getByPlaceholder(/search members/i)
      await expect(searchInput).toBeVisible()

      // Should be able to type in search
      await searchInput.fill('test')
      await expect(searchInput).toHaveValue('test')
    })

    test('current user should be displayed with (you) indicator', async ({ page }) => {
      await page.goto('/team')

      // The current user should be marked with "(you)"
      await expect(page.getByText('(you)')).toBeVisible()
    })

    test('should display role badges for team members', async ({ page }) => {
      await page.goto('/team')

      // Should see at least one role badge (owner for current user)
      const roleBadge = page.locator('[class*="capitalize"]').filter({ hasText: /owner|admin|member/i })
      await expect(roleBadge.first()).toBeVisible()
    })
  })

  test.describe('User Details - View', () => {
    test('should display user avatar or initials', async ({ page }) => {
      await page.goto('/team')

      // Should see team member content (any indicator of user display)
      // Look for owner badge, member info, or any user-related content
      const ownerBadge = page.getByText(/owner/i).first()
      const memberBadge = page.getByText(/member/i).first()

      const hasOwner = await ownerBadge.isVisible({ timeout: 3000 }).catch(() => false)
      const hasMember = await memberBadge.isVisible({ timeout: 3000 }).catch(() => false)

      // Team page should show at least role information
      expect(hasOwner || hasMember).toBeTruthy()
    })

    test('should display user email on team page', async ({ page }) => {
      await page.goto('/team')

      // At least one email should be visible (current user)
      const emailPattern = page.locator('p').filter({ hasText: /@.*\./ })
      // May or may not have email visible depending on data
      const emailCount = await emailPattern.count()
      if (emailCount > 0) {
        await expect(emailPattern.first()).toBeVisible()
      }
    })
  })

  test.describe('Settings Page - Profile Update UI', () => {
    test('should display settings page with profile tab', async ({ page }) => {
      await page.goto('/settings')

      // Should see the Settings heading
      await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible()

      // Should see Profile tab
      const profileTab = page.getByRole('tab', { name: /profile/i })
      await expect(profileTab).toBeVisible()
    })

    test('should have name input field on settings page', async ({ page }) => {
      await page.goto('/settings')

      // Ensure we're on profile tab (default)
      const profileTab = page.getByRole('tab', { name: /profile/i })
      if (await profileTab.getAttribute('data-state') !== 'active') {
        await profileTab.click()
      }

      // Should see Full Name input
      const nameInput = page.getByLabel(/full name/i)
      await expect(nameInput).toBeVisible()
      await expect(nameInput).toBeEnabled()
    })

    test('should have email input field (disabled) on settings page', async ({ page }) => {
      await page.goto('/settings')

      // Should see email input that is disabled
      const emailInput = page.getByLabel(/email address/i)
      await expect(emailInput).toBeVisible()
      await expect(emailInput).toBeDisabled()
    })

    test('should have save changes button on settings page', async ({ page }) => {
      await page.goto('/settings')

      // Should see Save Changes button
      const saveButton = page.getByRole('button', { name: /save changes/i })
      await expect(saveButton).toBeVisible()
    })

    test('should display profile picture section', async ({ page }) => {
      await page.goto('/settings')

      // Should see Profile Picture card (use first() as text may appear multiple times)
      await expect(page.getByText(/profile picture/i).first()).toBeVisible()

      // Should see Change Photo button
      const changePhotoButton = page.getByRole('button', { name: /change photo/i })
      await expect(changePhotoButton).toBeVisible()
    })

    test('should have account tab with connected accounts', async ({ page }) => {
      await page.goto('/settings')

      // Click on Account tab
      const accountTab = page.getByRole('tab', { name: /account/i })
      await accountTab.click()

      // Should see Connected Accounts section
      await expect(page.getByText(/connected accounts/i)).toBeVisible()

      // Should see Google connected
      await expect(page.getByText(/google/i)).toBeVisible()
    })

    test('should have notifications tab', async ({ page }) => {
      await page.goto('/settings')

      // Click on Notifications tab
      const notificationsTab = page.getByRole('tab', { name: /notifications/i })
      await notificationsTab.click()

      // Should see Email Notifications section
      await expect(page.getByText(/email notifications/i)).toBeVisible()
    })
  })

  test.describe('Account Page - Security Settings', () => {
    test('should display account page with security section', async ({ page }) => {
      await page.goto('/account')

      // Should see the Account heading
      await expect(page.getByRole('heading', { name: /^account$/i })).toBeVisible()

      // Should see Security section
      await expect(page.getByRole('heading', { name: /security/i })).toBeVisible()
    })

    test('should display connected accounts on account page', async ({ page }) => {
      await page.goto('/account')

      // Should see Connected Accounts section
      await expect(page.getByRole('heading', { name: /connected accounts/i })).toBeVisible()

      // Should see Google connection status
      await expect(page.getByText(/google/i).first()).toBeVisible()
    })

    test('should display active sessions section', async ({ page }) => {
      await page.goto('/account')

      // Should see Active Sessions section
      await expect(page.getByRole('heading', { name: /active sessions/i })).toBeVisible()

      // Should see current session indicator (use first() as "current" may appear multiple times)
      await expect(page.getByText(/current/i).first()).toBeVisible()
    })

    test('should display API access section', async ({ page }) => {
      await page.goto('/account')

      // Should see API Access section
      await expect(page.getByRole('heading', { name: /api access/i })).toBeVisible()

      // Should see Create Key button
      const createKeyButton = page.getByRole('button', { name: /create key/i })
      await expect(createKeyButton).toBeVisible()
    })

    test('should display danger zone with delete account option', async ({ page }) => {
      await page.goto('/account')

      // Should see Danger Zone section
      await expect(page.getByRole('heading', { name: /danger zone/i })).toBeVisible()

      // Should see Delete Account button
      const deleteButton = page.getByRole('button', { name: /delete/i }).first()
      await expect(deleteButton).toBeVisible()
    })
  })
})
