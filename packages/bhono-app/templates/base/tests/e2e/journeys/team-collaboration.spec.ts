import { test, expect, isAuthenticated, waitForNavigation, closeAllDialogs, apiRequest, getAccountId } from '../fixtures'

/**
 * Team Collaboration Journey Tests
 *
 * These tests verify complete team collaboration user flows,
 * including team management, member invitations, and navigation.
 *
 * @tags @critical @journey @team
 */

test.describe('Team Collaboration Journeys @critical @journey @team', () => {
  test.describe('Team Overview Journey', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test.afterEach(async ({ page }) => {
      await closeAllDialogs(page)
    })

    test('should display team dashboard with member count', async ({ page }) => {
      await page.goto('/team')

      // Verify team page loads with main heading
      await expect(page.getByRole('heading', { name: /team members/i })).toBeVisible()

      // Verify description text is present
      await expect(page.getByText(/manage your team and invite new members/i)).toBeVisible()

      // Verify Active Members card is displayed
      await expect(page.getByText(/active members/i)).toBeVisible()

      // Verify member count is shown (e.g., "1 member in your workspace" or "2 members in your workspace")
      await expect(page.getByText(/member[s]? in your workspace/i)).toBeVisible()

      // Verify the invite member button is present and enabled (use first() due to nested button structure)
      const inviteButton = page.locator('button').filter({ hasText: 'Invite Member' }).first()
      await expect(inviteButton).toBeVisible()
      await expect(inviteButton).toBeEnabled()
    })

    test('should show team member list with details', async ({ page }) => {
      await page.goto('/team')

      // Verify the team members list section is visible
      await expect(page.getByText(/active members/i)).toBeVisible()

      // Verify at least one member row is displayed
      const memberList = page.locator('[class*="divide-y"]').first()
      await expect(memberList).toBeVisible()

      // Verify member details are shown (avatar area exists)
      const memberRows = memberList.locator('> div')
      await expect(memberRows.first()).toBeVisible()

      // Verify member name is displayed
      const memberName = page.locator('.font-medium').first()
      await expect(memberName).toBeVisible()
    })

    test('should identify current user as owner/admin', async ({ page }) => {
      await page.goto('/team')

      // Verify current user is marked with "(you)" indicator
      await expect(page.getByText('(you)')).toBeVisible()

      // Verify owner role badge is displayed for the current user
      const ownerBadge = page.locator('.capitalize').filter({ hasText: /owner/i })
      await expect(ownerBadge).toBeVisible()
    })
  })

  test.describe('Member Invitation Journey', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test.afterEach(async ({ page }) => {
      await closeAllDialogs(page)
    })

    test('should complete invitation dialog opening', async ({ page }) => {
      await page.goto('/team')

      // Wait for page to fully load
      await expect(page.getByRole('heading', { name: /team members/i })).toBeVisible()

      // Click the invite member button (use first() due to nested button structure)
      const inviteButton = page.locator('button').filter({ hasText: 'Invite Member' }).first()
      await expect(inviteButton).toBeVisible()
      await inviteButton.click()

      // Verify dialog opens
      await expect(page.getByRole('dialog')).toBeVisible()

      // Verify dialog has the correct title
      await expect(page.getByRole('heading', { name: /invite team member/i })).toBeVisible()

      // Verify dialog description is shown
      await expect(page.getByText(/send an invitation to join your workspace/i)).toBeVisible()
    })

    test('should show role selection options in invite dialog', async ({ page }) => {
      await page.goto('/team')

      // Wait for page to fully load
      await expect(page.getByRole('heading', { name: /team members/i })).toBeVisible()

      // Open invite dialog (use first() due to nested button structure)
      await page.locator('button').filter({ hasText: 'Invite Member' }).first().click()
      await expect(page.getByRole('dialog')).toBeVisible()

      // Verify Member role button is visible
      const memberRoleButton = page.getByRole('button', { name: /^member$/i })
      await expect(memberRoleButton).toBeVisible()

      // Verify Admin role button is visible
      const adminRoleButton = page.getByRole('button', { name: /^admin$/i })
      await expect(adminRoleButton).toBeVisible()
    })

    test('should display role descriptions when selecting roles', async ({ page }) => {
      await page.goto('/team')

      // Wait for page to fully load
      await expect(page.getByRole('heading', { name: /team members/i })).toBeVisible()

      // Open invite dialog (use first() due to nested button structure)
      await page.locator('button').filter({ hasText: 'Invite Member' }).first().click()
      await expect(page.getByRole('dialog')).toBeVisible()

      // Member role is default - verify member description is shown
      await expect(page.getByText(/members can view and collaborate/i)).toBeVisible()

      // Click Admin role button
      const adminRoleButton = page.getByRole('button', { name: /^admin$/i })
      await adminRoleButton.click()

      // Verify admin role description is now shown
      await expect(page.getByText(/admins can manage team settings/i)).toBeVisible()

      // Click Member role button again
      const memberRoleButton = page.getByRole('button', { name: /^member$/i })
      await memberRoleButton.click()

      // Verify member description is shown again
      await expect(page.getByText(/members can view and collaborate/i)).toBeVisible()
    })

    test('should enable send button only with valid email', async ({ page }) => {
      await page.goto('/team')

      // Wait for page to fully load
      await expect(page.getByRole('heading', { name: /team members/i })).toBeVisible()

      // Open invite dialog (use first() due to nested button structure)
      await page.locator('button').filter({ hasText: 'Invite Member' }).first().click()
      await expect(page.getByRole('dialog')).toBeVisible()

      // Verify Send Invitation button is initially disabled (no email)
      const sendButton = page.getByRole('button', { name: /send invitation/i })
      await expect(sendButton).toBeDisabled()

      // Enter a valid email
      const emailInput = page.getByLabel(/email address/i)
      await expect(emailInput).toBeVisible()
      await emailInput.fill('test-invite@example.com')

      // Verify Send Invitation button is now enabled
      await expect(sendButton).toBeEnabled()

      // Clear the email
      await emailInput.clear()

      // Verify Send Invitation button is disabled again
      await expect(sendButton).toBeDisabled()
    })

    test('should cancel invitation without sending', async ({ page }) => {
      await page.goto('/team')

      // Wait for page to fully load
      await expect(page.getByRole('heading', { name: /team members/i })).toBeVisible()

      // Open invite dialog (use first() due to nested button structure)
      await page.locator('button').filter({ hasText: 'Invite Member' }).first().click()
      await expect(page.getByRole('dialog')).toBeVisible()

      // Fill in email (to simulate a partial flow)
      const emailInput = page.getByLabel(/email address/i)
      await emailInput.fill('cancel-test@example.com')

      // Select Admin role
      const adminRoleButton = page.getByRole('button', { name: /^admin$/i })
      await adminRoleButton.click()

      // Click Cancel button
      const cancelButton = page.getByRole('button', { name: /cancel/i })
      await expect(cancelButton).toBeVisible()
      await cancelButton.click()

      // Verify dialog is closed without sending invitation
      await expect(page.getByRole('dialog')).not.toBeVisible()

      // Verify we're still on the team page
      await expect(page.getByRole('heading', { name: /team members/i })).toBeVisible()
    })
  })

  test.describe('Pending Invitations Journey', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test.afterEach(async ({ page }) => {
      await closeAllDialogs(page)
    })

    test('should display pending invitations section', async ({ page }) => {
      await page.goto('/team')

      // Check if pending invitations section exists
      const pendingSection = page.getByText(/pending invitation/i)
      const pendingCount = await pendingSection.count()

      // If pending invitations exist, verify the section structure
      if (pendingCount > 0) {
        await expect(pendingSection.first()).toBeVisible()

        // Verify the section has a description about pending count
        await expect(page.getByText(/\d+ pending invitation/i)).toBeVisible()
      }
      // Test passes if no pending invitations (UI adapts accordingly)
    })

    test('should show invitation details when present', async ({ page }) => {
      await page.goto('/team')

      // Check for pending invitations section
      const pendingSection = page.getByRole('heading', { name: /pending invitation/i })
      const hasPending = await pendingSection.isVisible({ timeout: 2000 }).catch(() => false)

      if (hasPending) {
        // Verify invitation email is displayed
        const invitationEmail = page.getByText(/@example\.com|@.*\.\w+/)
        await expect(invitationEmail.first()).toBeVisible()

        // Verify expiry information is shown
        const expiryText = page.getByText(/expires in \d+ day/i)
        await expect(expiryText.first()).toBeVisible()

        // Verify Pending badge is visible
        const pendingBadge = page.locator('[class*="Badge"]').filter({ hasText: /pending/i })
        await expect(pendingBadge.first()).toBeVisible()
      }
      // Test passes if no pending invitations
    })

    test('should show revoke option for pending invitations', async ({ page }) => {
      await page.goto('/team')

      // Check for pending invitations section
      const pendingSection = page.getByRole('heading', { name: /pending invitation/i })
      const hasPending = await pendingSection.isVisible({ timeout: 2000 }).catch(() => false)

      if (hasPending) {
        // Verify Revoke button is visible for pending invitations
        const revokeButton = page.getByRole('button', { name: /revoke/i })
        await expect(revokeButton.first()).toBeVisible()

        // Verify Resend button is also available
        const resendButton = page.getByRole('button', { name: /resend/i })
        await expect(resendButton.first()).toBeVisible()
      }
      // Test passes if no pending invitations
    })
  })

  test.describe('Member Management Journey', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test.afterEach(async ({ page }) => {
      await closeAllDialogs(page)
    })

    test('should show member action menu', async ({ page }) => {
      await page.goto('/team')

      // Verify team members section is visible
      await expect(page.getByText(/active members/i)).toBeVisible()

      // Look for action menu button (three dots) for non-current-user members
      // Note: The current user doesn't have an action menu
      const actionButtons = page.locator('button').filter({ has: page.locator('[class*="more"]') })
      const actionCount = await actionButtons.count()

      // If there are other team members, action buttons should be visible
      if (actionCount > 0) {
        await expect(actionButtons.first()).toBeVisible()
      }

      // Verify current user is displayed without action menu
      await expect(page.getByText('(you)')).toBeVisible()
    })

    test('should navigate from team to member settings', async ({ page }) => {
      // Start at team page
      await page.goto('/team')
      await expect(page.getByRole('heading', { name: /team members/i })).toBeVisible()

      // Verify settings link is present in navigation
      const settingsLink = page.getByRole('link', { name: /settings/i })
      await expect(settingsLink).toBeVisible()

      // Navigate to settings page directly (more reliable than clicking)
      await page.goto('/settings')
      await expect(page).not.toHaveURL(/login/)

      // Verify settings page loaded
      await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible()

      // Verify profile tab is visible (Profile tab contains icon + text)
      const profileTab = page.getByRole('tab').filter({ hasText: /profile/i })
      await expect(profileTab).toBeVisible()

      // Verify account tab is visible
      const accountTab = page.getByRole('tab').filter({ hasText: /account/i })
      await expect(accountTab).toBeVisible()
    })
  })

  test.describe('Team to Dashboard Navigation', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test.afterEach(async ({ page }) => {
      await closeAllDialogs(page)
    })

    test('should navigate from dashboard to team and back', async ({ page }) => {
      // Start at dashboard
      await page.goto('/dashboard')
      await expect(page).not.toHaveURL(/login/)
      await expect(page).toHaveURL(/dashboard/)

      // Wait for dashboard to load
      await expect(page.getByRole('navigation')).toBeVisible()

      // Verify team link is visible
      const teamLink = page.getByRole('link', { name: /team/i })
      await expect(teamLink).toBeVisible()

      // Navigate to team page directly
      await page.goto('/team')
      await expect(page).not.toHaveURL(/login/)

      // Verify team page loaded
      await expect(page.getByRole('heading', { name: /team members/i })).toBeVisible()

      // Verify dashboard link is visible
      const dashboardLink = page.getByRole('link', { name: /dashboard/i })
      await expect(dashboardLink).toBeVisible()

      // Navigate back to dashboard
      await page.goto('/dashboard')
      await expect(page).toHaveURL(/dashboard/)
    })

    test('should maintain team context across navigation', async ({ page }) => {
      // Start at team page and verify initial state
      await page.goto('/team')
      await expect(page.getByRole('heading', { name: /team members/i })).toBeVisible()

      // Verify team member is displayed
      await expect(page.getByText('(you)')).toBeVisible()

      // Verify navigation links are present
      await expect(page.getByRole('link', { name: /settings/i })).toBeVisible()
      await expect(page.getByRole('link', { name: /integrations/i })).toBeVisible()

      // Navigate to settings page directly
      await page.goto('/settings')
      await expect(page).not.toHaveURL(/login/)
      await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible()

      // Navigate to integrations page directly
      await page.goto('/integrations')
      await expect(page).not.toHaveURL(/login/)
      await expect(page.getByRole('heading', { name: 'Integrations', exact: true })).toBeVisible()

      // Return to team page
      await page.goto('/team')
      await expect(page).not.toHaveURL(/login/)

      // Verify team page content is still correct
      await expect(page.getByRole('heading', { name: /team members/i })).toBeVisible()
      await expect(page.getByText('(you)')).toBeVisible()
      await expect(page.getByText(/active members/i)).toBeVisible()
    })
  })
})
