import { test, expect, isAuthenticated, closeAllDialogs } from './fixtures'

/**
 * Team management (local membership assignment) E2E.
 *
 * The Team page manages LOCAL account membership (admin/member/guest) — the assignment
 * surface the app owns, distinct from the gateway per-account roles shown on Workspaces.
 *
 * Each test establishes a fresh admin session with its own workspace (test-login's
 * ensureUserAccount guarantees an account), so the assignment UI is enabled
 * deterministically rather than depending on shared storageState under parallel workers.
 *
 * @tags @auth
 */
test.describe('Team management @auth', () => {
  test.beforeEach(async ({ page }) => {
    const authenticated = await isAuthenticated(page)
    test.skip(!authenticated, 'No valid session available. Run auth.setup.ts.')

    await page.goto('/login')
    const res = await page.request.post('/auth/test-login', {
      data: { email: 'team-admin@example.com', name: 'Team Admin', role: 'admin' },
      failOnStatusCode: false,
    })
    test.skip(!res.ok(), 'test-login unavailable')
  })

  test('renders the team management page', async ({ page }) => {
    await page.goto('/team')
    await expect(page).not.toHaveURL(/login/)
    await expect(page.getByRole('heading', { name: /team members/i })).toBeVisible()
  })

  test('opens the invite dialog with a role selector (assignment surface)', async ({ page }) => {
    await page.goto('/team')

    // The button enables once GET /accounts resolves the current workspace.
    const inviteButton = page.getByRole('button', { name: /invite member/i })
    await expect(inviteButton).toBeEnabled({ timeout: 8000 })
    await inviteButton.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText(/invite team member/i)).toBeVisible()

    // The role options the local membership contract supports (guest/member/admin).
    for (const role of ['guest', 'member', 'admin']) {
      await expect(dialog.getByText(new RegExp(`^${role}$`, 'i')).first()).toBeVisible()
    }

    await closeAllDialogs(page)
  })
})
