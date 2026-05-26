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

      // Verify ETUS Auth button is present and enabled
      const authButton = page.getByRole('button', { name: /continue with etus/i })
      await expect(authButton).toBeVisible()
      await expect(authButton).toBeEnabled()

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
      await expect(page.getByText('Active Members')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Invite Member' }).first()).toBeVisible()
    })

    test('should complete team invitation flow', async ({ page }) => {
      // Navigate to team page
      await page.goto('/team')
      await expect(page.getByRole('heading', { name: /team members/i })).toBeVisible()

      // Open invite dialog
      const inviteButton = page.getByRole('button', { name: 'Invite Member' }).first()
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
      await expect(page.getByRole('heading', { name: 'Profile Picture' })).toBeVisible()
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
      await expect(page.getByRole('heading', { name: 'Integrations', exact: true })).toBeVisible()

      // Step 6: Return to Dashboard (completing the circuit)
      const dashboardLink = page.getByRole('link', { name: /dashboard/i })
      await expect(dashboardLink).toBeVisible()
      await dashboardLink.click()
      await waitForNavigation(page, '/dashboard')
      await expect(page).toHaveURL(/dashboard/)
    })

    test('should complete settings profile update journey', async ({ page }) => {
      // Navigate to settings page
      await page.goto('/settings')
      await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible()

      // Ensure Profile tab is active
      const profileTab = page.getByRole('tab', { name: /profile/i })
      await expect(profileTab).toBeVisible()

      // Get the name input and store original value
      const nameInput = page.getByLabel(/full name/i)
      await expect(nameInput).toBeVisible()
      const originalName = await nameInput.inputValue()

      // Update name with new value
      const testName = 'Test User Updated'
      await nameInput.clear()
      await nameInput.fill(testName)

      // Click save button
      const saveButton = page.getByRole('button', { name: /save changes/i })
      await expect(saveButton).toBeVisible()
      await saveButton.click()

      // Wait for update to complete (button should not show spinner after)
      await expect(saveButton).toBeEnabled({ timeout: 5000 })

      // Verify we stayed on the settings page
      await expect(page).toHaveURL(/settings/)
      await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible()

      // Restore original value
      await nameInput.clear()
      await nameInput.fill(originalName || '')
      await saveButton.click()
      await expect(saveButton).toBeEnabled({ timeout: 5000 })
    })

    test('should complete webhook creation journey', async ({ page }) => {
      // Navigate to integrations page
      await page.goto('/integrations')
      await expect(page.getByRole('heading', { name: 'Integrations', exact: true })).toBeVisible()

      // Click Add Webhook button
      const addWebhookButton = page.getByRole('button', { name: 'Add Webhook' }).first()
      await expect(addWebhookButton).toBeVisible()
      await addWebhookButton.click()

      // Verify dialog opened (check for Create Webhook heading)
      const createWebhookHeading = page.getByRole('heading', { name: /create webhook/i })
      await expect(createWebhookHeading).toBeVisible()

      // Fill webhook URL
      const urlInput = page.getByPlaceholder('https://api.example.com/webhooks')
      await expect(urlInput).toBeVisible()
      await urlInput.fill('https://api.test.com/webhook')

      // Select User Created event
      const userCreatedEvent = page.getByRole('button', { name: 'User Created' })
      await expect(userCreatedEvent).toBeVisible()
      await userCreatedEvent.click()

      // Verify create button is now enabled (URL filled and event selected)
      const createButton = page.getByRole('button', { name: 'Create Webhook', exact: true })
      await expect(createButton).toBeEnabled()

      // Cancel to avoid test data pollution
      const cancelButton = page.getByRole('button', { name: 'Cancel' })
      await cancelButton.click()
      await expect(createWebhookHeading).not.toBeVisible()
    })

    test('should verify account security check journey', async ({ page }) => {
      // Navigate to account page
      await page.goto('/account')
      await expect(page.getByRole('heading', { name: /^account$/i })).toBeVisible()

      // Verify Security section is visible
      await expect(page.getByRole('heading', { name: /^security$/i })).toBeVisible()
      await expect(page.getByText(/two-factor authentication/i)).toBeVisible()

      // Verify Connected Accounts section with Google
      await expect(page.getByRole('heading', { name: /connected accounts/i })).toBeVisible()
      await expect(page.getByText('Google')).toBeVisible()
      // Verify Google shows as Connected (find the Connected badge near Google)
      const connectedAccountsSection = page.locator('section').filter({ hasText: 'Connected Accounts' })
      await expect(connectedAccountsSection.getByText('Connected').first()).toBeVisible()

      // Verify Active Sessions section with current session
      await expect(page.getByRole('heading', { name: /active sessions/i })).toBeVisible()
      await expect(page.getByText('Current', { exact: true })).toBeVisible()

      // Verify API Access section with Create Key button
      await expect(page.getByRole('heading', { name: /api access/i })).toBeVisible()
      const createKeyButton = page.getByRole('button', { name: /create key/i })
      await expect(createKeyButton).toBeVisible()
      await expect(createKeyButton).toBeEnabled()
    })
  })
})
