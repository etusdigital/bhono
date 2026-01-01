import { test, expect, isAuthenticated } from '../fixtures'

/**
 * Team CRUD E2E Tests
 *
 * Tests for team management functionality via the UI.
 * Focuses on team member management, roles, and invitation flows.
 *
 * @tags @crud
 */

test.describe('Team CRUD @crud', () => {
  test.beforeEach(async ({ page }) => {
    const authenticated = await isAuthenticated(page)
    test.skip(!authenticated, 'No authenticated session available')
  })

  test.describe('Team Members Display', () => {
    test('should show team members on team page', async ({ page }) => {
      await page.goto('/team')

      // Should see the Active Members card
      const activeMembersCard = page.getByText(/active members/i)
      await expect(activeMembersCard).toBeVisible()

      // Should show member count
      const memberCount = page.getByText(/\d+ member/)
      await expect(memberCount).toBeVisible()
    })

    test('should display team member details', async ({ page }) => {
      await page.goto('/team')

      // Team page should show team members section
      // Look for any indication of team member data (names, emails, roles)
      const memberSection = page.getByText(/active members|team members/i).first()
      const ownerBadge = page.getByText(/owner/i).first()

      const hasSection = await memberSection.isVisible({ timeout: 3000 }).catch(() => false)
      const hasOwner = await ownerBadge.isVisible({ timeout: 3000 }).catch(() => false)

      // Should have team member content visible
      expect(hasSection || hasOwner).toBeTruthy()
    })

    test('should display team page description', async ({ page }) => {
      await page.goto('/team')

      // Should see the description text
      await expect(page.getByText(/manage your team and invite new members/i)).toBeVisible()
    })
  })

  test.describe('Role Management UI', () => {
    test('should display role badges for team members', async ({ page }) => {
      await page.goto('/team')

      // Should see owner role badge for the main user
      const ownerBadge = page.locator('[class*="capitalize"]').filter({ hasText: /owner/i })
      await expect(ownerBadge).toBeVisible()
    })

    test('should have role selection in invite dialog', async ({ page }) => {
      await page.goto('/team')

      // Open invite dialog
      const inviteButton = page.getByRole('button', { name: /invite member/i }).first()
      await inviteButton.click()

      // Should see role selection buttons
      await expect(page.getByRole('button', { name: /^member$/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /^admin$/i })).toBeVisible()
    })

    test('should show role description when selecting roles', async ({ page }) => {
      await page.goto('/team')

      // Open invite dialog
      const inviteButton = page.getByRole('button', { name: /invite member/i }).first()
      await inviteButton.click()

      // Member role should be selected by default
      const memberButton = page.getByRole('button', { name: /^member$/i })
      await expect(memberButton).toBeVisible()

      // Should show member role description
      await expect(page.getByText(/members can view and collaborate/i)).toBeVisible()

      // Click admin role
      const adminButton = page.getByRole('button', { name: /^admin$/i })
      await adminButton.click()

      // Should show admin role description
      await expect(page.getByText(/admins can manage team settings/i)).toBeVisible()
    })
  })

  test.describe('Team Invitation Flow', () => {
    test('should open invite dialog when clicking invite button', async ({ page }) => {
      await page.goto('/team')

      // Click invite button
      const inviteButton = page.getByRole('button', { name: /invite member/i }).first()
      await inviteButton.click()

      // Dialog should be visible
      await expect(page.getByRole('dialog')).toBeVisible()

      // Dialog should have title
      await expect(page.getByRole('heading', { name: /invite team member/i })).toBeVisible()
    })

    test('should have email input in invite dialog', async ({ page }) => {
      await page.goto('/team')

      // Open invite dialog
      await page.getByRole('button', { name: /invite member/i }).first().click()

      // Should see email input
      const emailInput = page.getByLabel(/email address/i)
      await expect(emailInput).toBeVisible()
      await expect(emailInput).toBeEnabled()

      // Should have placeholder
      await expect(emailInput).toHaveAttribute('placeholder', /colleague@example\.com/i)
    })

    test('should have send invitation button in dialog', async ({ page }) => {
      await page.goto('/team')

      // Open invite dialog
      await page.getByRole('button', { name: /invite member/i }).first().click()

      // Should see Send Invitation button
      const sendButton = page.getByRole('button', { name: /send invitation/i })
      await expect(sendButton).toBeVisible()
    })

    test('should have cancel button in invite dialog', async ({ page }) => {
      await page.goto('/team')

      // Open invite dialog
      await page.getByRole('button', { name: /invite member/i }).first().click()

      // Should see Cancel button
      const cancelButton = page.getByRole('button', { name: /cancel/i })
      await expect(cancelButton).toBeVisible()

      // Clicking cancel should close dialog
      await cancelButton.click()
      await expect(page.getByRole('dialog')).not.toBeVisible()
    })

    test('send invitation button should be disabled without email', async ({ page }) => {
      await page.goto('/team')

      // Open invite dialog
      await page.getByRole('button', { name: /invite member/i }).first().click()

      // Send button should be disabled when email is empty
      const sendButton = page.getByRole('button', { name: /send invitation/i })
      await expect(sendButton).toBeDisabled()
    })

    test('should enable send button when email is entered', async ({ page }) => {
      await page.goto('/team')

      // Open invite dialog
      await page.getByRole('button', { name: /invite member/i }).first().click()

      // Enter email
      const emailInput = page.getByLabel(/email address/i)
      await emailInput.fill('test@example.com')

      // Send button should now be enabled
      const sendButton = page.getByRole('button', { name: /send invitation/i })
      await expect(sendButton).toBeEnabled()
    })

    test('should show invite dialog description', async ({ page }) => {
      await page.goto('/team')

      // Open invite dialog
      await page.getByRole('button', { name: /invite member/i }).first().click()

      // Should see description about invitation
      await expect(page.getByText(/send an invitation to join your workspace/i)).toBeVisible()
    })
  })

  test.describe('Pending Invitations', () => {
    test('should show pending invitations section if invitations exist', async ({ page }) => {
      await page.goto('/team')

      // Check for pending invitations section (may or may not be visible depending on data)
      const pendingSection = page.getByText(/pending invitation/i)
      const pendingCount = await pendingSection.count()

      if (pendingCount > 0) {
        await expect(pendingSection.first()).toBeVisible()
      }
    })

    test('should show resend and revoke buttons for pending invitations', async ({ page }) => {
      await page.goto('/team')

      // Look for pending invitation elements
      const pendingBadge = page.locator('[class*="Badge"]').filter({ hasText: /pending/i })
      const pendingCount = await pendingBadge.count()

      if (pendingCount > 0) {
        // Should see resend button
        await expect(page.getByRole('button', { name: /resend/i })).toBeVisible()

        // Should see revoke button
        await expect(page.getByRole('button', { name: /revoke/i })).toBeVisible()
      }
    })

    test('should show expiry information for pending invitations', async ({ page }) => {
      await page.goto('/team')

      // Look for expiry text
      const expiryText = page.getByText(/expires in \d+ day/i)
      const expiryCount = await expiryText.count()

      if (expiryCount > 0) {
        await expect(expiryText.first()).toBeVisible()
      }
    })
  })

  test.describe('Team Search', () => {
    test('should filter members when searching', async ({ page }) => {
      await page.goto('/team')

      // Get initial member count visible
      const memberSection = page.locator('[class*="divide-y"]').first()
      await expect(memberSection).toBeVisible()

      // Enter search that won't match anything
      const searchInput = page.getByPlaceholder(/search members/i)
      await searchInput.fill('nonexistent-member-xyz')

      // Should show "no members found" message
      await expect(page.getByText(/no members found/i)).toBeVisible()

      // Clear search
      await searchInput.clear()

      // Members should be visible again
      await expect(page.getByText(/no members found/i)).not.toBeVisible()
    })

    test('should search by name', async ({ page }) => {
      await page.goto('/team')

      // Search by partial name
      const searchInput = page.getByPlaceholder(/search members/i)
      await searchInput.fill('you')

      // Should still show current user (marked as "You")
      const memberRows = page.locator('[class*="divide-y"] > div')
      const visibleRows = await memberRows.count()
      expect(visibleRows).toBeGreaterThan(0)
    })
  })

  test.describe('Navigation', () => {
    test('should navigate to team page from sidebar', async ({ page }) => {
      await page.goto('/dashboard')

      // Look for team link in navigation
      const teamLink = page.getByRole('link', { name: /team/i })

      if (await teamLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await teamLink.click()
        await expect(page).toHaveURL(/team/)
        await expect(page.getByRole('heading', { name: /team members/i })).toBeVisible()
      }
    })

    test('should directly access team page via URL', async ({ page }) => {
      await page.goto('/team')

      // Should load team page without redirect to login
      await expect(page).not.toHaveURL(/login/)
      await expect(page.getByRole('heading', { name: /team members/i })).toBeVisible()
    })
  })
})
