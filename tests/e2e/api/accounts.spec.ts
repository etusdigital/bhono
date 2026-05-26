import { test, expect, isAuthenticated, apiRequest, getAccountId } from '../fixtures'

/**
 * Accounts API E2E tests for the @etus/auth account router.
 *
 * @tags @api @accounts
 */

test.describe('Accounts API @api @accounts', () => {
  test.beforeEach(async ({ page }) => {
    const authenticated = await isAuthenticated(page)
    test.skip(!authenticated, 'No authenticated session available')

    const accountId = getAccountId()
    test.skip(!accountId, 'No account ID available')
  })

  test('GET /accounts returns accounts for the authenticated user', async ({ page }) => {
    const response = await apiRequest(page, 'get', '/accounts')

    expect(response.status()).toBe(200)
    const body = await response.json()

    expect(Array.isArray(body.accounts)).toBe(true)
    expect(body.accounts.length).toBeGreaterThan(0)
    expect(body.accounts[0]).toHaveProperty('id')
    expect(body.accounts[0]).toHaveProperty('name')
    expect(body.accounts[0]).toHaveProperty('createdAt')
    expect(body.accounts[0]).toHaveProperty('role')
  })

  test('GET /accounts/:id returns current account info and membership', async ({ page }) => {
    const accountId = getAccountId()
    const response = await apiRequest(page, 'get', `/accounts/${accountId}`)

    expect(response.status()).toBe(200)
    const body = await response.json()

    expect(body.account).toHaveProperty('id', accountId)
    expect(body.account).toHaveProperty('name')
    expect(body.account).toHaveProperty('createdAt')
    expect(body.membership).toHaveProperty('accountId', accountId)
    expect(body.membership).toHaveProperty('role')
  })

  test('PATCH /accounts/:id updates account name and restores original value', async ({ page }) => {
    const accountId = getAccountId()
    const getResponse = await apiRequest(page, 'get', `/accounts/${accountId}`)
    expect(getResponse.status()).toBe(200)

    const originalBody = await getResponse.json()
    const originalName = originalBody.account.name
    const newName = `Test Account ${Date.now()}`

    const updateResponse = await apiRequest(page, 'patch', `/accounts/${accountId}`, {
      data: { name: newName },
    })

    expect(updateResponse.status()).toBe(200)
    const updatedBody = await updateResponse.json()
    expect(updatedBody.account.name).toBe(newName)

    const restoreResponse = await apiRequest(page, 'patch', `/accounts/${accountId}`, {
      data: { name: originalName },
    })

    expect(restoreResponse.status()).toBe(200)
    const restoredBody = await restoreResponse.json()
    expect(restoredBody.account.name).toBe(originalName)
  })

  test('GET /accounts/:id/members lists account members', async ({ page }) => {
    const accountId = getAccountId()
    const response = await apiRequest(page, 'get', `/accounts/${accountId}/members`)

    expect(response.status()).toBe(200)
    const body = await response.json()

    expect(Array.isArray(body.members)).toBe(true)
    expect(body.members.length).toBeGreaterThan(0)
    expect(body.members[0]).toHaveProperty('userId')
    expect(body.members[0]).toHaveProperty('role')
    expect(body.members[0]).toHaveProperty('user')
  })

  test('GET /accounts/:id returns 404 for an unknown account id', async ({ page }) => {
    const response = await apiRequest(page, 'get', '/accounts/00000000-0000-0000-0000-000000000000')

    expect(response.status()).toBe(404)
    const body = await response.json()
    expect(body).toHaveProperty('error')
  })

  test('GET /accounts/:id treats malformed ids as unknown package ids', async ({ page }) => {
    const response = await apiRequest(page, 'get', '/accounts/not-a-valid-uuid')

    expect(response.status()).toBe(404)
    const body = await response.json()
    expect(body).toHaveProperty('error')
  })
})
