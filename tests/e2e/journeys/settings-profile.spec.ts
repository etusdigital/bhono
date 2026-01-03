import { test, expect, isAuthenticated, closeAllDialogs } from '../fixtures'

/**
 * Settings & Profile Journey Tests
 *
 * These tests verify complete settings page user flows,
 * including profile management, account settings, and notifications.
 *
 * @tags @critical @journey @settings
 */

test.describe('Settings & Profile Journeys @critical @journey @settings', () => {
  test.describe('Profile Tab Journey', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test.afterEach(async ({ page }) => {
      await closeAllDialogs(page)
    })

    test('should display settings page with profile tab active', async ({ page }) => {
      await page.goto('/settings')

      // Verify settings page loads
      await expect(page.getByRole('heading', { name: /settings/i, level: 1 })).toBeVisible()

      // Verify description is present
      await expect(page.getByText(/manage your account settings and preferences/i)).toBeVisible()

      // Verify tabs are present
      const profileTab = page.getByRole('tab', { name: /profile/i })
      await expect(profileTab).toBeVisible()
      await expect(profileTab).toHaveAttribute('data-state', 'active')
    })

    test('should display profile picture section', async ({ page }) => {
      await page.goto('/settings')

      // Verify Profile Picture card
      await expect(page.getByRole('heading', { name: 'Profile Picture' })).toBeVisible()

      // Verify description
      await expect(page.getByText(/your profile picture is visible to other team members/i)).toBeVisible()

      // Verify Change Photo button
      const changePhotoButton = page.getByRole('button', { name: /change photo/i })
      await expect(changePhotoButton).toBeVisible()
      await expect(changePhotoButton).toBeEnabled()

      // Verify file size hint
      await expect(page.getByText(/max 2mb/i)).toBeVisible()
    })

    test('should display personal information form', async ({ page }) => {
      await page.goto('/settings')

      // Verify Personal Information card
      await expect(page.getByRole('heading', { name: /personal information/i })).toBeVisible()

      // Verify form description
      await expect(page.getByText(/update your personal details here/i)).toBeVisible()

      // Verify Full Name input
      const nameInput = page.getByLabel(/full name/i)
      await expect(nameInput).toBeVisible()
      await expect(nameInput).toBeEnabled()

      // Verify Email input (should be disabled)
      const emailInput = page.getByLabel(/email address/i)
      await expect(emailInput).toBeVisible()
      await expect(emailInput).toBeDisabled()

      // Verify email cannot be changed message
      await expect(page.getByText(/email cannot be changed/i)).toBeVisible()

      // Verify Save Changes button
      const saveButton = page.getByRole('button', { name: /save changes/i })
      await expect(saveButton).toBeVisible()
      await expect(saveButton).toBeEnabled()
    })

    test('should update profile name and save', async ({ page }) => {
      await page.goto('/settings')

      // Get the name input and store original value
      const nameInput = page.getByLabel(/full name/i)
      await expect(nameInput).toBeVisible()
      const originalName = await nameInput.inputValue()

      // Update name with new value
      const testName = 'Test User ' + Date.now()
      await nameInput.clear()
      await nameInput.fill(testName)

      // Click save button
      const saveButton = page.getByRole('button', { name: /save changes/i })
      await expect(saveButton).toBeVisible()
      await saveButton.click()

      // Wait for save operation (button should re-enable after save)
      await expect(saveButton).toBeEnabled({ timeout: 5000 })

      // Verify we stayed on the settings page
      await expect(page).toHaveURL(/settings/)

      // Restore original value
      await nameInput.clear()
      await nameInput.fill(originalName || '')
      await saveButton.click()
      await expect(saveButton).toBeEnabled({ timeout: 5000 })
    })

    test('should show loading state while saving', async ({ page }) => {
      await page.goto('/settings')

      // Get the name input and modify it
      const nameInput = page.getByLabel(/full name/i)
      await expect(nameInput).toBeVisible()
      const originalName = await nameInput.inputValue()

      await nameInput.clear()
      await nameInput.fill('Loading Test User')

      // Click save button
      const saveButton = page.getByRole('button', { name: /save changes/i })
      await saveButton.click()

      // Verify button becomes disabled during save (loading state)
      await expect(saveButton).toBeDisabled()

      // Wait for save to complete
      await expect(saveButton).toBeEnabled({ timeout: 5000 })

      // Restore original name
      await nameInput.clear()
      await nameInput.fill(originalName || '')
      await saveButton.click()
      await expect(saveButton).toBeEnabled({ timeout: 5000 })
    })
  })

  test.describe('Account Tab Journey', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test.afterEach(async ({ page }) => {
      await closeAllDialogs(page)
    })

    test('should switch to account tab', async ({ page }) => {
      await page.goto('/settings')

      // Click on Account tab
      const accountTab = page.getByRole('tab', { name: /account/i })
      await expect(accountTab).toBeVisible()
      await accountTab.click()

      // Verify Account tab is now active
      await expect(accountTab).toHaveAttribute('data-state', 'active')
    })

    test('should display connected accounts section', async ({ page }) => {
      await page.goto('/settings')

      // Switch to Account tab
      const accountTab = page.getByRole('tab', { name: /account/i })
      await accountTab.click()

      // Verify Connected Accounts card
      await expect(page.getByRole('heading', { name: /connected accounts/i })).toBeVisible()

      // Verify description
      await expect(page.getByText(/manage your connected oauth providers/i)).toBeVisible()

      // Verify Google connection is shown
      await expect(page.getByText('Google')).toBeVisible()
      await expect(page.getByText(/connected/i).first()).toBeVisible()
    })

    test('should display sessions section', async ({ page }) => {
      await page.goto('/settings')

      // Switch to Account tab
      const accountTab = page.getByRole('tab', { name: /account/i })
      await accountTab.click()

      // Verify Sessions card
      await expect(page.getByRole('heading', { name: /sessions/i })).toBeVisible()

      // Verify description
      await expect(page.getByText(/manage your active sessions across devices/i)).toBeVisible()

      // Verify current session is displayed
      await expect(page.getByText(/current session/i)).toBeVisible()
      await expect(page.getByText(/active/i).first()).toBeVisible()
    })

    test('should display danger zone section', async ({ page }) => {
      await page.goto('/settings')

      // Switch to Account tab
      const accountTab = page.getByRole('tab', { name: /account/i })
      await accountTab.click()

      // Verify Danger Zone card
      await expect(page.getByRole('heading', { name: /danger zone/i })).toBeVisible()

      // Verify description
      await expect(page.getByText(/irreversible and destructive actions/i)).toBeVisible()

      // Verify Delete Account option
      await expect(page.getByText(/delete account/i).first()).toBeVisible()
      await expect(page.getByText(/permanently delete your account and all associated data/i)).toBeVisible()

      // Verify Delete Account button is present
      const deleteButton = page.getByRole('button', { name: /delete account/i })
      await expect(deleteButton).toBeVisible()
      await expect(deleteButton).toBeEnabled()
    })
  })

  test.describe('Notifications Tab Journey', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test.afterEach(async ({ page }) => {
      await closeAllDialogs(page)
    })

    test('should switch to notifications tab', async ({ page }) => {
      await page.goto('/settings')

      // Click on Notifications tab
      const notificationsTab = page.getByRole('tab', { name: /notifications/i })
      await expect(notificationsTab).toBeVisible()
      await notificationsTab.click()

      // Verify Notifications tab is now active
      await expect(notificationsTab).toHaveAttribute('data-state', 'active')
    })

    test('should display email notifications section', async ({ page }) => {
      await page.goto('/settings')

      // Switch to Notifications tab
      const notificationsTab = page.getByRole('tab', { name: /notifications/i })
      await notificationsTab.click()

      // Verify Email Notifications card
      await expect(page.getByRole('heading', { name: /email notifications/i })).toBeVisible()

      // Verify description
      await expect(page.getByText(/choose what emails you want to receive/i)).toBeVisible()
    })

    test('should display all notification toggles', async ({ page }) => {
      await page.goto('/settings')

      // Switch to Notifications tab
      const notificationsTab = page.getByRole('tab', { name: /notifications/i })
      await notificationsTab.click()

      // Verify Team Invitations toggle
      await expect(page.getByText('Team Invitations').first()).toBeVisible()
      await expect(page.getByText(/receive emails when someone invites you to a team/i)).toBeVisible()

      // Verify Product Updates toggle
      await expect(page.getByText('Product Updates').first()).toBeVisible()
      await expect(page.getByText(/news about product updates and new features/i)).toBeVisible()

      // Verify Security Alerts toggle
      await expect(page.getByText('Security Alerts').first()).toBeVisible()
      await expect(page.getByText(/important notifications about your account security/i)).toBeVisible()
    })

    test('should toggle notification switches', async ({ page }) => {
      await page.goto('/settings')

      // Switch to Notifications tab
      const notificationsTab = page.getByRole('tab', { name: /notifications/i })
      await notificationsTab.click()

      // Find Team Invitations toggle switch
      const teamInvitationsRow = page.locator('div').filter({ hasText: /^Team Invitations/ })
      const toggleSwitch = teamInvitationsRow.getByRole('switch').first()

      // Verify switch is visible and can be toggled
      await expect(toggleSwitch).toBeVisible()

      // Get initial state
      const initialState = await toggleSwitch.getAttribute('aria-checked')

      // Click to toggle
      await toggleSwitch.click()

      // Verify state changed
      const newState = await toggleSwitch.getAttribute('aria-checked')
      expect(newState).not.toBe(initialState)

      // Click again to restore
      await toggleSwitch.click()
      const restoredState = await toggleSwitch.getAttribute('aria-checked')
      expect(restoredState).toBe(initialState)
    })

    test('should have security alerts toggle that cannot be toggled', async ({ page }) => {
      await page.goto('/settings')

      // Switch to Notifications tab
      const notificationsTab = page.getByRole('tab', { name: /notifications/i })
      await notificationsTab.click()

      // Verify Security Alerts section exists
      await expect(page.getByText('Security Alerts').first()).toBeVisible()
      await expect(page.getByText(/important notifications about your account security/i)).toBeVisible()

      // Find the toggle switches - Security Alerts is the last one (third toggle)
      const toggleSwitches = page.getByRole('switch')
      const securityToggle = toggleSwitches.nth(2)

      // Verify the toggle is visible
      await expect(securityToggle).toBeVisible()

      // Get initial state
      const initialState = await securityToggle.getAttribute('aria-checked')

      // Try to click it - it should be disabled and not change
      await securityToggle.click({ force: true })

      // State should remain the same (toggle is disabled)
      const afterClickState = await securityToggle.getAttribute('aria-checked')
      expect(afterClickState).toBe(initialState)
    })
  })

  test.describe('Settings Navigation Journey', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test.afterEach(async ({ page }) => {
      await closeAllDialogs(page)
    })

    test('should navigate through all settings tabs', async ({ page }) => {
      await page.goto('/settings')

      // Start at Profile tab (default)
      const profileTab = page.getByRole('tab', { name: /profile/i })
      await expect(profileTab).toHaveAttribute('data-state', 'active')
      await expect(page.getByRole('heading', { name: 'Profile Picture' })).toBeVisible()

      // Navigate to Account tab
      const accountTab = page.getByRole('tab', { name: /account/i })
      await accountTab.click()
      await expect(accountTab).toHaveAttribute('data-state', 'active')
      await expect(page.getByRole('heading', { name: /connected accounts/i })).toBeVisible()

      // Navigate to Notifications tab
      const notificationsTab = page.getByRole('tab', { name: /notifications/i })
      await notificationsTab.click()
      await expect(notificationsTab).toHaveAttribute('data-state', 'active')
      await expect(page.getByRole('heading', { name: /email notifications/i })).toBeVisible()

      // Navigate back to Profile tab
      await profileTab.click()
      await expect(profileTab).toHaveAttribute('data-state', 'active')
      await expect(page.getByRole('heading', { name: 'Profile Picture' })).toBeVisible()
    })

    test('should navigate from settings to other pages and back', async ({ page }) => {
      // Start at settings
      await page.goto('/settings')
      await expect(page.getByRole('heading', { name: /settings/i, level: 1 })).toBeVisible()

      // Navigate to dashboard
      await page.goto('/dashboard')
      await expect(page).toHaveURL(/dashboard/)

      // Return to settings
      await page.goto('/settings')
      await expect(page.getByRole('heading', { name: /settings/i, level: 1 })).toBeVisible()

      // Navigate to team
      await page.goto('/team')
      await expect(page.getByRole('heading', { name: /team members/i })).toBeVisible()

      // Return to settings
      await page.goto('/settings')
      await expect(page.getByRole('heading', { name: /settings/i, level: 1 })).toBeVisible()
    })
  })
})
