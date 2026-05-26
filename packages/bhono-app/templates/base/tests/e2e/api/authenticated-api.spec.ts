import { test, expect, isAuthenticated, apiRequest, getAccountId } from '../fixtures'

/**
 * Authenticated API smoke tests for package-owned auth routes.
 *
 * @tags @api
 */

test.describe('Authenticated API @api', () => {
  test.beforeEach(async ({ page }) => {
    const authenticated = await isAuthenticated(page)
    test.skip(!authenticated, 'No authenticated session available')

    const accountId = getAccountId()
    test.skip(!accountId, 'No account ID available')
  })

  test('GET /auth/me returns the package user shape', async ({ page }) => {
    const response = await page.request.get('/auth/me')

    expect(response.status()).toBe(200)
    const body = await response.json()

    expect(body).toHaveProperty('user')
    expect(typeof body.user.id).toBe('string')
    expect(typeof body.user.email).toBe('string')
    expect(body.user).toHaveProperty('role')
  })

  test('GET /accounts returns the accounts owned by the current session', async ({ page }) => {
    const response = await apiRequest(page, 'get', '/accounts')

    expect(response.status()).toBe(200)
    const body = await response.json()

    expect(Array.isArray(body.accounts)).toBe(true)
    expect(body.accounts.length).toBeGreaterThan(0)
    expect(body.accounts[0]).toHaveProperty('id')
    expect(body.accounts[0]).toHaveProperty('name')
    expect(body.accounts[0]).toHaveProperty('role')
  })

  test('GET /accounts/:id returns account and membership context', async ({ page }) => {
    const accountId = getAccountId()
    const response = await apiRequest(page, 'get', `/accounts/${accountId}`)

    expect(response.status()).toBe(200)
    const body = await response.json()

    expect(body.account).toHaveProperty('id', accountId)
    expect(body.account).toHaveProperty('name')
    expect(body.membership).toHaveProperty('accountId', accountId)
    expect(body.membership).toHaveProperty('role')
  })

  test('GET /accounts/:id/members returns active account members', async ({ page }) => {
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

  test('GET /accounts/:id/invitations returns the package invitation list', async ({ page }) => {
    const accountId = getAccountId()
    const response = await apiRequest(page, 'get', `/accounts/${accountId}/invitations`)

    expect(response.status()).toBe(200)
    const body = await response.json()

    expect(Array.isArray(body.invitations)).toBe(true)
  })

  test('POST /accounts/:id/members/invite requires the boilerplate membership role contract', async ({ page }) => {
    const accountId = getAccountId()
    const response = await apiRequest(page, 'post', `/accounts/${accountId}/members/invite`, {
      data: { email: `missing-role-${Date.now()}@example.com` },
    })

    expect(response.status()).toBe(400)
    const body = await response.json()
    expect(body.error.message).toBe('Membership role is required')
  })

  test('GET /auth/admin/users exposes package admin user management for product admins', async ({ page }) => {
    const response = await apiRequest(page, 'get', '/auth/admin/users')

    if (response.status() === 403) {
      test.skip(true, 'Captured OAuth user is not an @etus/auth product admin')
    }

    expect(response.status()).toBe(200)
    const body = await response.json()

    expect(Array.isArray(body.users)).toBe(true)
    expect(typeof body.total).toBe('number')
  })

  test('JSON responses keep the expected content type', async ({ page }) => {
    const response = await apiRequest(page, 'get', '/accounts')

    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toMatch(/application\/json/)
  })
})
