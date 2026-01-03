import { test, expect, isAuthenticated, apiRequest, getAccountId, closeAllDialogs } from '../fixtures'

/**
 * RBAC Enforcement Journey Tests
 *
 * These tests verify role-based access control (RBAC) enforcement,
 * including permission checks, role verification, and access restrictions.
 *
 * Note: Tests focus on verifying RBAC UI elements and API behaviors
 * visible to the authenticated test user (typically ADMIN/OWNER).
 *
 * @tags @journey @rbac @security
 */

test.describe('RBAC Enforcement Journey @journey @rbac', () => {
  test.describe('Role Display Verification', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test.afterEach(async ({ page }) => {
      await closeAllDialogs(page)
    })

    test('should display current user role on team page', async ({ page }) => {
      // Step 1: Navigate to team page
      await page.goto('/team')
      await expect(page.getByRole('heading', { name: /team members/i })).toBeVisible()

      // Step 2: Verify current user indicator
      await expect(page.getByText('(you)')).toBeVisible()

      // Step 3: Verify role badge is displayed (Owner/Admin for test user)
      const roleBadge = page.locator('.capitalize').filter({ hasText: /owner|admin/i })
      await expect(roleBadge).toBeVisible()
    })

    test('should display role options in invite dialog', async ({ page }) => {
      // Step 1: Navigate to team page
      await page.goto('/team')
      await expect(page.getByRole('heading', { name: /team members/i })).toBeVisible()

      // Step 2: Open invite dialog
      await page.locator('button').filter({ hasText: 'Invite Member' }).first().click()
      await expect(page.getByRole('dialog')).toBeVisible()

      // Step 3: Verify Member role option
      const memberRoleButton = page.getByRole('button', { name: /^member$/i })
      await expect(memberRoleButton).toBeVisible()

      // Step 4: Verify Admin role option
      const adminRoleButton = page.getByRole('button', { name: /^admin$/i })
      await expect(adminRoleButton).toBeVisible()

      // Step 5: Verify role descriptions
      await memberRoleButton.click()
      await expect(page.getByText(/members can view and collaborate/i)).toBeVisible()

      await adminRoleButton.click()
      await expect(page.getByText(/admins can manage team settings/i)).toBeVisible()

      // Step 6: Clean up
      await page.getByRole('button', { name: /cancel/i }).click()
    })
  })

  test.describe('Admin Permission Verification', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')

      const accountId = getAccountId()
      test.skip(!accountId, 'No account ID available')
    })

    test.afterEach(async ({ page }) => {
      await closeAllDialogs(page)
    })

    test('admin should see invite member button', async ({ page }) => {
      // Step 1: Navigate to team page
      await page.goto('/team')

      // Step 2: Verify invite button is visible (admin permission)
      const inviteButton = page.locator('button').filter({ hasText: 'Invite Member' }).first()
      await expect(inviteButton).toBeVisible()
      await expect(inviteButton).toBeEnabled()
    })

    test('admin should be able to access all settings tabs', async ({ page }) => {
      // Step 1: Navigate to settings
      await page.goto('/settings')
      await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible()

      // Step 2: Verify Profile tab is accessible
      const profileTab = page.getByRole('tab', { name: /profile/i })
      await expect(profileTab).toBeVisible()
      await profileTab.click()
      await expect(page.getByRole('heading', { name: 'Profile Picture' })).toBeVisible()

      // Step 3: Verify Account tab is accessible
      const accountTab = page.getByRole('tab', { name: /account/i })
      await expect(accountTab).toBeVisible()
      await accountTab.click()
      await expect(page.getByRole('heading', { name: /connected accounts/i })).toBeVisible()

      // Step 4: Verify Notifications tab is accessible
      const notificationsTab = page.getByRole('tab', { name: /notifications/i })
      await expect(notificationsTab).toBeVisible()
      await notificationsTab.click()
      await expect(page.getByRole('heading', { name: /email notifications/i })).toBeVisible()
    })

    test('admin should access account danger zone', async ({ page }) => {
      // Step 1: Navigate to account page
      await page.goto('/account')
      await expect(page.getByRole('heading', { name: /^account$/i, level: 1 })).toBeVisible()

      // Step 2: Verify Danger Zone is visible (admin permission)
      await expect(page.getByRole('heading', { name: /danger zone/i })).toBeVisible()

      // Step 3: Verify Delete Account option exists
      await expect(page.getByText('Delete Account').first()).toBeVisible()

      // Step 4: Verify Export Data option exists
      await expect(page.getByText('Export Data')).toBeVisible()
    })

    test('admin should manage API keys', async ({ page }) => {
      // Step 1: Navigate to account page
      await page.goto('/account')

      // Step 2: Verify API Access section is visible
      await expect(page.getByRole('heading', { name: /api access/i })).toBeVisible()

      // Step 3: Verify Create Key button is available
      const createKeyButton = page.getByRole('button', { name: /create key/i })
      await expect(createKeyButton).toBeVisible()
      await expect(createKeyButton).toBeEnabled()
    })
  })

  test.describe('Invitation Permission Verification', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')

      const accountId = getAccountId()
      test.skip(!accountId, 'No account ID available')
    })

    test('should list invitations via API', async ({ page }) => {
      // Step 1: Fetch invitations
      const response = await apiRequest(page, 'get', '/api/invitations')

      // Step 2: Verify response (admin can list invitations)
      expect(response.ok()).toBeTruthy()

      const body = await response.json()
      expect(body).toHaveProperty('data')
      expect(body).toHaveProperty('meta')
    })

    test('should display pending invitations on team page', async ({ page }) => {
      // Step 1: Navigate to team page
      await page.goto('/team')
      await expect(page.getByRole('heading', { name: /team members/i })).toBeVisible()

      // Step 2: Check for pending invitations section (may or may not exist)
      const pendingSection = page.getByRole('heading', { name: /pending invitation/i })
      const hasPending = await pendingSection.isVisible({ timeout: 2000 }).catch(() => false)

      // Step 3: If pending invitations exist, verify admin actions
      if (hasPending) {
        // Verify Revoke button exists (admin permission)
        const revokeButton = page.getByRole('button', { name: /revoke/i })
        await expect(revokeButton.first()).toBeVisible()

        // Verify Resend button exists (admin permission)
        const resendButton = page.getByRole('button', { name: /resend/i })
        await expect(resendButton.first()).toBeVisible()
      }
      // Test passes regardless - just verifying permissions are respected
    })
  })

  test.describe('Account Management Permissions', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')

      const accountId = getAccountId()
      test.skip(!accountId, 'No account ID available')
    })

    test('admin should be able to update account name', async ({ page }) => {
      const accountId = getAccountId()

      // Step 1: Get original account data
      const getResponse = await apiRequest(page, 'get', `/api/accounts/${accountId}`)
      expect(getResponse.ok()).toBeTruthy()

      const originalData = await getResponse.json()
      const originalName = originalData.data.name

      // Step 2: Update account name
      const newName = `RBAC Test ${Date.now()}`
      const updateResponse = await apiRequest(page, 'patch', `/api/accounts/${accountId}`, {
        data: { name: newName },
      })

      // Step 3: Verify update succeeded (admin permission)
      expect(updateResponse.ok()).toBeTruthy()

      // Step 4: Restore original name
      await apiRequest(page, 'patch', `/api/accounts/${accountId}`, {
        data: { name: originalName },
      })
    })

    test('admin should access user list via API', async ({ page }) => {
      // Step 1: Fetch users
      const response = await apiRequest(page, 'get', '/api/users')

      // Step 2: Verify admin can list users
      expect(response.ok()).toBeTruthy()

      const body = await response.json()
      expect(body).toHaveProperty('data')
      expect(body.data.length).toBeGreaterThan(0)
    })
  })

  test.describe('Security Settings Permissions', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test.afterEach(async ({ page }) => {
      await closeAllDialogs(page)
    })

    test('should display security options', async ({ page }) => {
      // Step 1: Navigate to account page
      await page.goto('/account')

      // Step 2: Verify Security section
      await expect(page.getByRole('heading', { name: /^security$/i })).toBeVisible()

      // Step 3: Verify Two-Factor Authentication option
      await expect(page.getByText(/two-factor authentication/i)).toBeVisible()
      const enableButton = page.getByRole('button', { name: /enable/i })
      await expect(enableButton).toBeVisible()

      // Step 4: Verify Password section (disabled for OAuth users)
      await expect(page.getByText('Password').first()).toBeVisible()
    })

    test('should display active sessions management', async ({ page }) => {
      // Step 1: Navigate to account page
      await page.goto('/account')

      // Step 2: Verify Active Sessions section
      await expect(page.getByRole('heading', { name: /active sessions/i })).toBeVisible()

      // Step 3: Verify current session is marked
      await expect(page.getByText('Current', { exact: true })).toBeVisible()

      // Step 4: Verify Sign out all button (admin/owner permission)
      const signOutAllButton = page.getByRole('button', { name: /sign out all/i })
      await expect(signOutAllButton).toBeVisible()
    })
  })

  test.describe('Webhook Management Permissions', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test.afterEach(async ({ page }) => {
      await closeAllDialogs(page)
    })

    test('admin should access webhook management', async ({ page }) => {
      // Step 1: Navigate to integrations page
      await page.goto('/integrations')
      await expect(page.getByRole('heading', { name: 'Integrations', exact: true })).toBeVisible()

      // Step 2: Verify Webhooks section
      await expect(page.getByRole('heading', { name: /webhooks/i })).toBeVisible()

      // Step 3: Verify Add Webhook button (admin permission)
      const addWebhookButton = page.getByRole('button', { name: 'Add Webhook' }).first()
      await expect(addWebhookButton).toBeVisible()
      await expect(addWebhookButton).toBeEnabled()
    })

    test('admin should access webhook creation dialog', async ({ page }) => {
      // Step 1: Navigate to integrations
      await page.goto('/integrations')

      // Step 2: Open webhook dialog
      await page.getByRole('button', { name: 'Add Webhook' }).first().click()

      // Step 3: Verify dialog content (admin can create webhooks)
      await expect(page.getByRole('heading', { name: /create webhook/i })).toBeVisible()
      await expect(page.getByLabel(/endpoint url/i)).toBeVisible()
      await expect(page.getByText(/events to subscribe/i)).toBeVisible()

      // Step 4: Clean up
      await page.getByRole('button', { name: 'Cancel' }).click()
    })
  })

  test.describe('Complete RBAC Workflow', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')

      const accountId = getAccountId()
      test.skip(!accountId, 'No account ID available')
    })

    test.afterEach(async ({ page }) => {
      await closeAllDialogs(page)
    })

    test('complete RBAC verification workflow', async ({ page }) => {
      // Step 1: Verify team management access
      await page.goto('/team')
      await expect(page.getByRole('heading', { name: /team members/i })).toBeVisible()
      await expect(page.getByText('(you)')).toBeVisible()

      // Admin role badge visible
      const roleBadge = page.locator('.capitalize').filter({ hasText: /owner|admin/i })
      await expect(roleBadge).toBeVisible()

      // Invite button accessible
      const inviteButton = page.locator('button').filter({ hasText: 'Invite Member' }).first()
      await expect(inviteButton).toBeVisible()

      // Step 2: Verify settings access
      await page.goto('/settings')
      await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible()

      // All tabs accessible
      await expect(page.getByRole('tab', { name: /profile/i })).toBeVisible()
      await expect(page.getByRole('tab', { name: /account/i })).toBeVisible()
      await expect(page.getByRole('tab', { name: /notifications/i })).toBeVisible()

      // Step 3: Verify account page permissions
      await page.goto('/account')
      await expect(page.getByRole('heading', { name: /^account$/i, level: 1 })).toBeVisible()

      // Security section accessible
      await expect(page.getByRole('heading', { name: /^security$/i })).toBeVisible()

      // Danger Zone accessible (admin/owner)
      await expect(page.getByRole('heading', { name: /danger zone/i })).toBeVisible()

      // API Access accessible
      await expect(page.getByRole('heading', { name: /api access/i })).toBeVisible()

      // Step 4: Verify integrations access
      await page.goto('/integrations')
      await expect(page.getByRole('heading', { name: 'Integrations', exact: true })).toBeVisible()

      // Webhook management accessible
      await expect(page.getByRole('button', { name: 'Add Webhook' }).first()).toBeVisible()

      // Step 5: Verify API-level permissions
      const usersResponse = await apiRequest(page, 'get', '/api/users')
      expect(usersResponse.ok()).toBeTruthy()

      const invitationsResponse = await apiRequest(page, 'get', '/api/invitations')
      expect(invitationsResponse.ok()).toBeTruthy()

      const auditsResponse = await apiRequest(page, 'get', '/api/audits')
      expect(auditsResponse.ok()).toBeTruthy()

      // Step 6: Return to dashboard
      await page.goto('/dashboard')
      await expect(page).toHaveURL(/dashboard/)
    })
  })
})
