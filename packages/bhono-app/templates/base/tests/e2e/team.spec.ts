import { test, expect, isAuthenticated } from './fixtures'

/**
 * Team management (local membership) E2E — smoke.
 *
 * The Team page manages LOCAL account membership (admin/member/guest) — the assignment
 * surface the app owns, distinct from the gateway per-account roles shown on Workspaces.
 *
 * Note: the interactive invite/role-assignment flow depends on GET /accounts returning
 * the current workspace, which the Vite dev server serves from the SPA fallback rather
 * than the worker — so the invite button stays disabled under `pnpm dev`. The
 * assignment logic is covered at the integration layer (tests/integration), which
 * drives the real worker via buildApp(). Here we smoke-test that the page and its
 * assignment entry point render.
 *
 * @tags @auth
 */
test.describe('Team management @auth', () => {
  test.beforeEach(async ({ page }) => {
    const authenticated = await isAuthenticated(page)
    test.skip(!authenticated, 'No valid session available. Run auth.setup.ts.')
  })

  test('renders the team management page', async ({ page }) => {
    await page.goto('/team')
    await expect(page).not.toHaveURL(/login/)
    await expect(page.getByRole('heading', { name: /team members/i })).toBeVisible()
  })

  test('shows the invite (assignment) entry point', async ({ page }) => {
    await page.goto('/team')
    await expect(page.getByRole('button', { name: /invite member/i })).toBeVisible()
  })
})
