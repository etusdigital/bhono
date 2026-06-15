import { test, expect, isAuthenticated } from './fixtures'

/**
 * Workspaces (gateway per-account roles) E2E.
 *
 * The Workspaces page reads the user's gateway accounts from GET /api/me
 * (useGatewayAccounts). With the dev gateway mock OFF, /api/me is empty and the page
 * shows its empty state; with it ON (ETUS_GATEWAY_MOCK=1 in .dev.vars) a scenario user
 * sees their per-account roles. These tests adapt to both so the suite stays green in
 * CI while still exercising the rich path locally.
 *
 * @tags @auth
 */
test.describe('Workspaces @auth', () => {
  test.beforeEach(async ({ page }) => {
    const authenticated = await isAuthenticated(page)
    test.skip(!authenticated, 'No valid session available. Run auth.setup.ts.')
  })

  test('renders the Workspaces page for an authenticated user', async ({ page }) => {
    await page.goto('/workspaces')
    await expect(page).not.toHaveURL(/login/)

    await expect(page.getByRole('heading', { name: /workspaces/i })).toBeVisible()
    // Either gateway-role cards (mock on) or the empty state (mock off) — either one
    // proves the page rendered through routing + the useGatewayAccounts query.
    await expect(
      page.getByText(/No workspaces yet|Read-only access|Create and update|Manage members|Invite members/i),
    ).toBeVisible()
  })

  test('is reachable from the sidebar nav', async ({ page }) => {
    await page.goto('/dashboard')

    const link = page.getByRole('link', { name: /workspaces/i })
    await expect(link).toBeVisible()
    await link.click()

    await expect(page).toHaveURL(/workspaces/)
    await expect(page.getByRole('heading', { name: /workspaces/i })).toBeVisible()
  })

  test('shows per-account gateway roles when the dev mock is enabled', async ({ page, baseURL }) => {
    // Log in as a scenario user: admin on Initech + viewer on Acme (the over-grant case).
    const login = await page.request.post('/auth/test-login', {
      data: { email: 'multi@example.com', name: 'Multi Workspace' },
      failOnStatusCode: false,
    })
    test.skip(!login.ok(), 'test-login unavailable')

    // Only assert the rich UI when the gateway mock is actually serving the scenario.
    const me = await page.request.get(`${baseURL ?? ''}/api/me`)
    const body = (me.ok() ? await me.json() : { accounts: [] }) as { accounts?: unknown[] }
    test.skip(
      !Array.isArray(body.accounts) || body.accounts.length === 0,
      'gateway mock disabled — set ETUS_GATEWAY_MOCK=1 in .dev.vars to run this',
    )

    await page.goto('/workspaces')
    await expect(page.getByRole('heading', { name: /workspaces/i })).toBeVisible()

    // The two distinct per-account roles render side by side. Use exact matches so the
    // workspace NAME ("Initech") isn't conflated with its slug ("initech").
    await expect(page.getByText('Initech', { exact: true })).toBeVisible()
    await expect(page.getByText('Acme Corporation', { exact: true })).toBeVisible()
    await expect(page.getByText('admin', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('viewer', { exact: true }).first()).toBeVisible()
  })
})
