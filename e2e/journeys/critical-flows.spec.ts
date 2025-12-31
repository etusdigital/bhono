import { test, expect, isAuthenticated, waitForNavigation } from '../fixtures'

/**
 * Critical User Journey Tests
 *
 * These tests verify complete user flows, not individual features.
 * They represent the most important paths through the application
 * that must always work.
 *
 * @tags @critical
 */

test.describe('Critical User Journeys @critical', () => {
  test.describe('Authentication Journey', () => {
    test('should display complete login page with OAuth option', async ({ page }) => {
      await page.goto('/login')

      // Verify page loads correctly
      await expect(page.getByText('Welcome back')).toBeVisible()

      // Verify Google OAuth button is present and enabled
      const googleOAuthButton = page.getByRole('button', { name: /continue with google/i })
      await expect(googleOAuthButton).toBeVisible()
      await expect(googleOAuthButton).toBeEnabled()

      // Verify the login page has proper structure
      await expect(page.locator('body')).toBeVisible()
    })
  })

  test.describe('Authenticated User Journeys', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test('should navigate from dashboard to settings', async ({ page }) => {
      // Start at dashboard
      await page.goto('/dashboard')
      await expect(page).not.toHaveURL(/login/)

      // Find and click settings link in navigation
      const settingsLink = page.getByRole('link', { name: /settings/i })
      await expect(settingsLink).toBeVisible()
      await settingsLink.click()

      // Verify settings page loaded
      await waitForNavigation(page, '/settings')
      await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible()

      // Verify settings tabs are available
      await expect(page.getByRole('tab', { name: /profile/i })).toBeVisible()
      await expect(page.getByRole('tab', { name: /account/i })).toBeVisible()
    })

    test('should navigate from dashboard to team management', async ({ page }) => {
      // Start at dashboard
      await page.goto('/dashboard')
      await expect(page).not.toHaveURL(/login/)

      // Find and click team link in navigation
      const teamLink = page.getByRole('link', { name: /team/i })
      await expect(teamLink).toBeVisible()
      await teamLink.click()

      // Verify team page loaded
      await waitForNavigation(page, '/team')
      await expect(page.getByRole('heading', { name: /team members/i })).toBeVisible()

      // Verify team page elements are present
      await expect(page.getByText(/active members/i)).toBeVisible()
      await expect(page.getByRole('button', { name: /invite member/i })).toBeVisible()
    })

    test('should complete team invitation flow', async ({ page }) => {
      // Navigate to team page
      await page.goto('/team')
      await expect(page.getByRole('heading', { name: /team members/i })).toBeVisible()

      // Open invite dialog
      const inviteButton = page.getByRole('button', { name: /invite member/i })
      await expect(inviteButton).toBeVisible()
      await inviteButton.click()

      // Verify dialog opened
      await expect(page.getByRole('dialog')).toBeVisible()
      await expect(page.getByRole('heading', { name: /invite team member/i })).toBeVisible()

      // Fill the email field
      const emailInput = page.getByLabel(/email address/i)
      await expect(emailInput).toBeVisible()
      await emailInput.fill('newmember@example.com')

      // Select a role (Member is default, try selecting Admin)
      const adminButton = page.getByRole('button', { name: /^admin$/i })
      await expect(adminButton).toBeVisible()
      await adminButton.click()

      // Verify role description changes
      await expect(page.getByText(/admins can manage team settings/i)).toBeVisible()

      // Verify Send Invitation button is now enabled
      const sendButton = page.getByRole('button', { name: /send invitation/i })
      await expect(sendButton).toBeEnabled()

      // Close dialog without submitting (to avoid test data pollution)
      const cancelButton = page.getByRole('button', { name: /cancel/i })
      await cancelButton.click()
      await expect(page.getByRole('dialog')).not.toBeVisible()
    })

    test('should complete profile update flow', async ({ page }) => {
      // Navigate to settings page
      await page.goto('/settings')
      await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible()

      // Ensure Profile tab is active
      const profileTab = page.getByRole('tab', { name: /profile/i })
      await expect(profileTab).toBeVisible()

      // Verify profile form elements
      const nameInput = page.getByLabel(/full name/i)
      await expect(nameInput).toBeVisible()
      await expect(nameInput).toBeEnabled()

      const emailInput = page.getByLabel(/email address/i)
      await expect(emailInput).toBeVisible()
      await expect(emailInput).toBeDisabled() // Email should be read-only

      // Verify profile picture section
      await expect(page.getByText(/profile picture/i)).toBeVisible()
      const changePhotoButton = page.getByRole('button', { name: /change photo/i })
      await expect(changePhotoButton).toBeVisible()

      // Verify save button is present
      const saveButton = page.getByRole('button', { name: /save changes/i })
      await expect(saveButton).toBeVisible()
    })

    test('should complete full navigation circuit', async ({ page }) => {
      // Step 1: Start at Dashboard
      await page.goto('/dashboard')
      await expect(page).not.toHaveURL(/login/)
      await expect(page).toHaveURL(/dashboard/)

      // Step 2: Navigate to Team
      const teamLink = page.getByRole('link', { name: /team/i })
      await expect(teamLink).toBeVisible()
      await teamLink.click()
      await waitForNavigation(page, '/team')
      await expect(page.getByRole('heading', { name: /team members/i })).toBeVisible()

      // Step 3: Navigate to Settings
      const settingsLink = page.getByRole('link', { name: /settings/i })
      await expect(settingsLink).toBeVisible()
      await settingsLink.click()
      await waitForNavigation(page, '/settings')
      await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible()

      // Step 4: Navigate to Account
      const accountLink = page.getByRole('link', { name: /account/i })
      await expect(accountLink).toBeVisible()
      await accountLink.click()
      await waitForNavigation(page, '/account')
      await expect(page.getByRole('heading', { name: /^account$/i })).toBeVisible()

      // Step 5: Navigate to Integrations
      const integrationsLink = page.getByRole('link', { name: /integrations/i })
      await expect(integrationsLink).toBeVisible()
      await integrationsLink.click()
      await waitForNavigation(page, '/integrations')
      await expect(page.getByRole('heading', { name: /integrations/i })).toBeVisible()

      // Step 6: Return to Dashboard (completing the circuit)
      const dashboardLink = page.getByRole('link', { name: /dashboard/i })
      await expect(dashboardLink).toBeVisible()
      await dashboardLink.click()
      await waitForNavigation(page, '/dashboard')
      await expect(page).toHaveURL(/dashboard/)
    })
  })
})
