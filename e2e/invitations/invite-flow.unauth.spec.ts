import { test, expect } from '@playwright/test'

/**
 * Invitation Flow E2E Tests
 *
 * Tests for the invitation acceptance flow via /invite/:token routes.
 * These are public pages that don't require authentication.
 *
 * @tags @invitation
 */

test.describe('Invitation Flow @invitation', () => {
  test.describe('Valid Invitation Token', () => {
    test('should display invitation page for valid token @critical', async ({ page }) => {
      // Navigate to invitation page with a valid token
      await page.goto('/invite/valid-token-123')

      // Should see the invitation card with h3 heading (CardTitle uses h3)
      await expect(page.getByRole('heading', { name: /you've been invited/i })).toBeVisible()

      // Should display workspace name (in the details section with exact match)
      await expect(page.getByText('Acme Inc', { exact: true }).first()).toBeVisible()

      // Should display inviter name (in the description)
      await expect(page.getByText('John Doe', { exact: true })).toBeVisible()
    })

    test('should have accept invitation button when valid @critical', async ({ page }) => {
      await page.goto('/invite/valid-token-123')

      // Should have Accept Invitation button
      const acceptButton = page.getByRole('button', { name: /accept invitation/i })
      await expect(acceptButton).toBeVisible()
      await expect(acceptButton).toBeEnabled()
    })

    test('should display invitation details correctly', async ({ page }) => {
      await page.goto('/invite/valid-token-123')

      // Should show email in the details section (exact match)
      await expect(page.getByText('invited@example.com', { exact: true })).toBeVisible()

      // Should show workspace in the details section
      await expect(page.getByText('Acme Inc', { exact: true }).first()).toBeVisible()

      // Should show role in the details section
      await expect(page.getByText('member', { exact: true })).toBeVisible()
    })

    test('should have decline button', async ({ page }) => {
      await page.goto('/invite/valid-token-123')

      // Should have Decline button
      const declineButton = page.getByRole('link', { name: /decline/i })
      await expect(declineButton).toBeVisible()
    })

    test('should show terms and privacy policy links', async ({ page }) => {
      await page.goto('/invite/valid-token-123')

      // Should show legal text with links
      await expect(page.getByText(/terms of service/i)).toBeVisible()
      await expect(page.getByText(/privacy policy/i)).toBeVisible()
    })

    test('should accept invitation and show success message @critical', async ({ page }) => {
      await page.goto('/invite/valid-token-123')

      // Click accept button
      const acceptButton = page.getByRole('button', { name: /accept invitation/i })
      await acceptButton.click()

      // Should show loading state (use button-specific selector to avoid matching other text)
      await expect(page.getByRole('button', { name: /accepting/i })).toBeVisible()

      // After acceptance, should show success message (use more flexible matching)
      await expect(page.getByRole('heading', { name: /welcome to/i })).toBeVisible({
        timeout: 5000,
      })
      await expect(page.getByText(/your invitation has been accepted/i)).toBeVisible()

      // Should have button to go to dashboard
      await expect(page.getByRole('link', { name: /go to dashboard/i })).toBeVisible()
    })
  })

  test.describe('Invitation URL Handling', () => {
    test('should handle invitation URL with query parameters', async ({ page }) => {
      // Navigate with query parameters
      await page.goto('/invite/valid-token-123?ref=email&utm_source=notification')

      // Should still display the invitation page correctly
      await expect(page.getByRole('heading', { name: /you've been invited/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /accept invitation/i })).toBeVisible()
    })

    test('should handle various token formats', async ({ page }) => {
      // Test with different token formats
      const tokens = [
        'abc123',
        'token-with-dashes',
        'TOKEN_WITH_UNDERSCORES',
        'mixedCase123Token',
      ]

      for (const token of tokens) {
        await page.goto(`/invite/${token}`)
        // Should load the invitation page (mock returns valid for all tokens)
        await expect(page.getByRole('heading', { name: /you've been invited/i })).toBeVisible()
      }
    })
  })

  test.describe('Navigation', () => {
    test('should have header with logo link to homepage', async ({ page }) => {
      await page.goto('/invite/valid-token-123')

      // Should have header with logo
      const logoLink = page.getByRole('link').filter({ has: page.locator('svg') }).first()
      await expect(logoLink).toBeVisible()

      // Logo should link to homepage
      await expect(logoLink).toHaveAttribute('href', '/')
    })

    test('should navigate to homepage when clicking decline', async ({ page }) => {
      await page.goto('/invite/valid-token-123')

      // Click decline
      await page.getByRole('link', { name: /decline/i }).click()

      // Should navigate to homepage
      await expect(page).toHaveURL('/')
    })
  })

  test.describe('Accessibility', () => {
    test('should have proper heading hierarchy', async ({ page }) => {
      await page.goto('/invite/valid-token-123')

      // CardTitle uses h3 for the main heading
      const heading = page.getByRole('heading', { level: 3 })
      await expect(heading).toBeVisible()
    })

    test('should have accessible button labels', async ({ page }) => {
      await page.goto('/invite/valid-token-123')

      // Buttons should have accessible names
      await expect(page.getByRole('button', { name: /accept invitation/i })).toBeVisible()
      await expect(page.getByRole('link', { name: /decline/i })).toBeVisible()
    })
  })
})

/**
 * Note: The following tests are for invalid/expired token scenarios.
 * Currently, the invitation page uses mock data that always returns valid.
 * These tests document the expected behavior when the backend is implemented.
 *
 * To fully test these scenarios, the backend API should be implemented to:
 * 1. Validate tokens against the database
 * 2. Return appropriate error states for invalid/expired tokens
 */
test.describe('Invalid Invitation Scenarios @invitation', () => {
  test.describe.skip('Invalid Token Handling (requires backend)', () => {
    test('should show error for invalid token', async ({ page }) => {
      await page.goto('/invite/invalid-token')

      // Should show invalid invitation message
      await expect(page.getByRole('heading', { name: /invalid invitation/i })).toBeVisible()
      await expect(
        page.getByText(/this invitation link is not valid/i)
      ).toBeVisible()

      // Should have button to go to homepage
      await expect(page.getByRole('link', { name: /go to homepage/i })).toBeVisible()
    })

    test('should show error for expired token', async ({ page }) => {
      await page.goto('/invite/expired-token')

      // Should show expired invitation message
      await expect(page.getByRole('heading', { name: /invitation expired/i })).toBeVisible()
      await expect(
        page.getByText(/this invitation link has expired/i)
      ).toBeVisible()
    })

    test('should redirect authenticated user trying to accept own invite', async ({ page }) => {
      // This test would require:
      // 1. Being authenticated as user@example.com
      // 2. Trying to accept an invite sent to user@example.com
      // The expected behavior is to show a message or redirect

      await page.goto('/invite/own-invite-token')

      // Should show appropriate message
      await expect(
        page.getByText(/you cannot accept your own invitation/i)
      ).toBeVisible()
    })
  })
})
