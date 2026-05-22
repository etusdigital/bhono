import { test, expect, isAuthenticated, apiRequest, getAccountId, closeAllDialogs } from '../fixtures'

/**
 * Multi-Account Experience Journey Tests
 *
 * These tests verify complete multi-account/multi-tenant flows,
 * including account listing, switching context, and account isolation.
 *
 * @tags @journey @accounts @multi-tenant
 */

test.describe('Multi-Account Experience Journey @journey @accounts', () => {
  test.describe('Account Listing Journey', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')

      const accountId = getAccountId()
      test.skip(!accountId, 'No account ID available')
    })

    test.afterEach(async ({ page }) => {
      await closeAllDialogs(page)
    })

    test('should list all user accounts via API', async ({ page }) => {
      // Step 1: Fetch all accounts for the user
      const response = await apiRequest(page, 'get', '/accounts')
      expect(response.ok()).toBeTruthy()

      const body = await response.json()

      // Step 2: Verify response structure
      expect(body).toHaveProperty('accounts')
      expect(Array.isArray(body.accounts)).toBe(true)

      // Step 3: User should have at least one account
      expect(body.accounts.length).toBeGreaterThan(0)
    })

    test('should have valid account structure', async ({ page }) => {
      // Step 1: Fetch accounts
      const response = await apiRequest(page, 'get', '/accounts')
      expect(response.ok()).toBeTruthy()

      const body = await response.json()

      // Step 2: Verify each account has required fields
      for (const account of body.accounts) {
        expect(account).toHaveProperty('id')
        expect(account).toHaveProperty('name')
        expect(account).toHaveProperty('createdAt')
        expect(account).toHaveProperty('updatedAt')

        // Step 3: Verify field types
        expect(typeof account.id).toBe('string')
        expect(typeof account.name).toBe('string')
      }
    })
  })

  test.describe('Current Account Context Journey', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')

      const accountId = getAccountId()
      test.skip(!accountId, 'No account ID available')
    })

    test('should get current account details', async ({ page }) => {
      const accountId = getAccountId()

      // Step 1: Fetch current account details
      const response = await apiRequest(page, 'get', `/accounts/${accountId}`)
      expect(response.ok()).toBeTruthy()

      const body = await response.json()

      // Step 2: Verify response structure
      expect(body).toHaveProperty('account')
      expect(body.account).toHaveProperty('id', accountId)
      expect(body.account).toHaveProperty('name')

      // Step 3: Verify account has timestamps
      expect(body.account).toHaveProperty('createdAt')
      expect(body.account).toHaveProperty('updatedAt')
    })

    test('should update account name and restore', async ({ page }) => {
      const accountId = getAccountId()

      // Step 1: Get original account data
      const getResponse = await apiRequest(page, 'get', `/accounts/${accountId}`)
      expect(getResponse.ok()).toBeTruthy()

      const originalData = await getResponse.json()
      const originalName = originalData.account.name

      // Step 2: Update account name
      const newName = `Test Multi-Account ${Date.now()}`
      const updateResponse = await apiRequest(page, 'patch', `/accounts/${accountId}`, {
        data: { name: newName },
      })

      expect(updateResponse.ok()).toBeTruthy()
      const updatedData = await updateResponse.json()
      expect(updatedData.account.name).toBe(newName)

      // Step 3: Verify update persisted
      const verifyResponse = await apiRequest(page, 'get', `/accounts/${accountId}`)
      const verifyData = await verifyResponse.json()
      expect(verifyData.account.name).toBe(newName)

      // Step 4: Restore original name
      const restoreResponse = await apiRequest(page, 'patch', `/accounts/${accountId}`, {
        data: { name: originalName },
      })
      expect(restoreResponse.ok()).toBeTruthy()
    })
  })

  test.describe('Account Members Journey', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')

      const accountId = getAccountId()
      test.skip(!accountId, 'No account ID available')
    })

    test('should list account members via users API', async ({ page }) => {
      // Step 1: Fetch users in current account context
      const accountId = getAccountId()
      const response = await apiRequest(page, 'get', `/accounts/${accountId}/members`)
      expect(response.ok()).toBeTruthy()

      const body = await response.json()

      // Step 2: Verify response structure
      expect(body).toHaveProperty('members')
      expect(Array.isArray(body.members)).toBe(true)

      // Step 3: Account should have at least one member (current user)
      expect(body.members.length).toBeGreaterThan(0)

      // Step 4: Verify user structure
      const member = body.members[0]
      expect(member).toHaveProperty('userId')
      expect(member).toHaveProperty('role')
      expect(member).toHaveProperty('user')
    })

    test('should display team members on team page', async ({ page }) => {
      // Step 1: Navigate to team page
      await page.goto('/team')
      await expect(page.getByRole('heading', { name: /team members/i })).toBeVisible()

      // Step 2: Verify Active Members section
      await expect(page.getByText(/active members/i)).toBeVisible()

      // Step 3: Verify member count is displayed
      await expect(page.getByText(/member[s]? in your workspace/i)).toBeVisible()

      // Step 4: Verify current user is shown with (you) indicator
      await expect(page.getByText('(you)')).toBeVisible()
    })
  })

  test.describe('Account Isolation Journey', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')

      const accountId = getAccountId()
      test.skip(!accountId, 'No account ID available')
    })

    test('should return 404 for non-existent account', async ({ page }) => {
      // Step 1: Try to access non-existent account
      const nonExistentId = '00000000-0000-0000-0000-000000000000'
      const response = await apiRequest(page, 'get', `/accounts/${nonExistentId}`)

      // Step 2: Should return 404
      expect(response.status()).toBe(404)

      const body = await response.json()
      expect(body).toHaveProperty('error')
      expect(body.error).toHaveProperty('message')
    })

    test('should return validation error for invalid account ID format', async ({ page }) => {
      // Step 1: Try to access with invalid ID format
      const invalidId = 'invalid-uuid-format'
      const response = await apiRequest(page, 'get', `/accounts/${invalidId}`)

      // Step 2: Package account routes treat ids as opaque strings
      expect(response.status()).toBe(404)

      const body = await response.json()
      expect(body).toHaveProperty('error')
    })
  })

  test.describe('Account Page UI Journey', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test.afterEach(async ({ page }) => {
      await closeAllDialogs(page)
    })

    test('should display account page with all sections', async ({ page }) => {
      // Step 1: Navigate to account page
      await page.goto('/account')
      await expect(page.getByRole('heading', { name: /^account$/i, level: 1 })).toBeVisible()

      // Step 2: Verify Connected Accounts section
      await expect(page.getByRole('heading', { name: /connected accounts/i })).toBeVisible()
      await expect(page.getByText('Google')).toBeVisible()

      // Step 3: Verify Security section
      await expect(page.getByRole('heading', { name: /^security$/i })).toBeVisible()
      await expect(page.getByText(/two-factor authentication/i)).toBeVisible()

      // Step 4: Verify Active Sessions section
      await expect(page.getByRole('heading', { name: /active sessions/i })).toBeVisible()

      // Step 5: Verify API Access section
      await expect(page.getByRole('heading', { name: /api access/i })).toBeVisible()
    })

    test('should display workspace information', async ({ page }) => {
      // Step 1: Navigate to team page
      await page.goto('/team')

      // Step 2: Verify workspace member count
      await expect(page.getByText(/member[s]? in your workspace/i)).toBeVisible()

      // Step 3: Verify workspace name or account context is maintained
      await expect(page.getByRole('heading', { name: /team members/i })).toBeVisible()

      // Step 4: Navigate to dashboard and back
      await page.goto('/dashboard')
      await expect(page).toHaveURL(/dashboard/)

      await page.goto('/team')
      await expect(page.getByRole('heading', { name: /team members/i })).toBeVisible()
    })
  })

  test.describe('Complete Multi-Account Workflow', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')

      const accountId = getAccountId()
      test.skip(!accountId, 'No account ID available')
    })

    test.afterEach(async ({ page }) => {
      await closeAllDialogs(page)
    })

    test('complete multi-account management workflow', async ({ page }) => {
      const accountId = getAccountId()

      // Step 1: List all accounts
      const accountsResponse = await apiRequest(page, 'get', '/accounts')
      expect(accountsResponse.ok()).toBeTruthy()
      const accountsData = await accountsResponse.json()
      expect(accountsData.accounts.length).toBeGreaterThan(0)

      // Step 2: Get current account details
      const currentAccountResponse = await apiRequest(page, 'get', `/accounts/${accountId}`)
      expect(currentAccountResponse.ok()).toBeTruthy()
      const currentAccount = await currentAccountResponse.json()
      expect(currentAccount.account).toHaveProperty('id', accountId)

      // Step 3: List users in current account
      const usersResponse = await apiRequest(page, 'get', `/accounts/${accountId}/members`)
      expect(usersResponse.ok()).toBeTruthy()
      const usersData = await usersResponse.json()
      expect(usersData.members.length).toBeGreaterThan(0)

      // Step 4: Verify account context in UI
      await page.goto('/team')
      await expect(page.getByRole('heading', { name: /team members/i })).toBeVisible()
      await expect(page.getByText('(you)')).toBeVisible()

      // Step 5: Navigate to account page
      await page.goto('/account')
      await expect(page.getByRole('heading', { name: /^account$/i, level: 1 })).toBeVisible()

      // Step 6: Verify account-scoped audit logs
      const auditResponse = await apiRequest(page, 'get', '/audit/logs?limit=5')
      expect(auditResponse.ok()).toBeTruthy()
      const auditData = await auditResponse.json()
      expect(auditData).toHaveProperty('logs')

      // Step 7: Verify user can view connected accounts
      await expect(page.getByText('Google')).toBeVisible()

      // Step 8: Return to dashboard
      await page.goto('/dashboard')
      await expect(page).toHaveURL(/dashboard/)
    })
  })
})
