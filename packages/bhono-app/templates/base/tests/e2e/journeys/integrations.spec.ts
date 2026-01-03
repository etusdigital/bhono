import { test, expect, isAuthenticated, closeAllDialogs } from '../fixtures'

/**
 * Integration Management Journey Tests
 *
 * These tests verify complete integration management user flows,
 * including browsing integrations, webhooks, and API documentation.
 *
 * @tags @critical @journey @integrations
 */

test.describe('Integration Management Journeys @critical @journey @integrations', () => {
  test.describe('Integrations Overview Journey', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test.afterEach(async ({ page }) => {
      await closeAllDialogs(page)
    })

    test('should display integrations page with header', async ({ page }) => {
      await page.goto('/integrations')

      // Verify page loads with main heading
      await expect(page.getByRole('heading', { name: 'Integrations', exact: true })).toBeVisible()

      // Verify description
      await expect(page.getByText(/connect third-party services and manage webhooks/i)).toBeVisible()

      // Verify connected count indicator
      await expect(page.getByText(/\d+ connected/)).toBeVisible()
    })

    test('should display search input', async ({ page }) => {
      await page.goto('/integrations')

      // Verify search input is visible
      const searchInput = page.getByPlaceholder(/search integrations/i)
      await expect(searchInput).toBeVisible()
      await expect(searchInput).toBeEnabled()
    })

    test('should display category filter buttons', async ({ page }) => {
      await page.goto('/integrations')

      // Verify all category buttons are visible
      await expect(page.getByRole('button', { name: 'All' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Communication' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Payments' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Development' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Automation' })).toBeVisible()
    })

    test('should display available integrations section', async ({ page }) => {
      await page.goto('/integrations')

      // Verify Available Integrations heading
      await expect(page.getByRole('heading', { name: /available integrations/i })).toBeVisible()

      // Verify some integration cards are visible (using first() to handle multiple matches)
      await expect(page.getByText('Slack').first()).toBeVisible()
      await expect(page.getByText('Discord').first()).toBeVisible()
      await expect(page.getByText('Stripe').first()).toBeVisible()
    })

    test('should display integration cards with details', async ({ page }) => {
      await page.goto('/integrations')

      // Verify Slack integration card
      await expect(page.getByText('Slack').first()).toBeVisible()
      await expect(page.getByText(/send notifications and updates to slack channels/i)).toBeVisible()

      // Verify Stripe integration card
      await expect(page.getByText('Stripe').first()).toBeVisible()
      await expect(page.getByText(/process payments and manage subscriptions/i)).toBeVisible()

      // Verify GitHub integration card
      await expect(page.getByText('GitHub').first()).toBeVisible()
      await expect(page.getByText(/sync repositories and track issues/i)).toBeVisible()
    })
  })

  test.describe('Integration Search Journey', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test.afterEach(async ({ page }) => {
      await closeAllDialogs(page)
    })

    test('should filter integrations by search', async ({ page }) => {
      await page.goto('/integrations')

      // Type in search
      const searchInput = page.getByPlaceholder(/search integrations/i)
      await searchInput.fill('slack')

      // Verify only Slack is visible
      await expect(page.getByText('Slack').first()).toBeVisible()

      // Verify other integrations are not visible
      await expect(page.getByText('Discord').first()).not.toBeVisible()
      await expect(page.getByText('Stripe').first()).not.toBeVisible()
    })

    test('should show no results message when search has no matches', async ({ page }) => {
      await page.goto('/integrations')

      // Type search that has no matches
      const searchInput = page.getByPlaceholder(/search integrations/i)
      await searchInput.fill('nonexistentintegration')

      // Verify no results message
      await expect(page.getByText(/no integrations found matching your search/i)).toBeVisible()
    })

    test('should clear search and show all integrations', async ({ page }) => {
      await page.goto('/integrations')

      const searchInput = page.getByPlaceholder(/search integrations/i)

      // Search for specific integration
      await searchInput.fill('github')
      await expect(page.getByText('GitHub').first()).toBeVisible()
      await expect(page.getByText('Slack').first()).not.toBeVisible()

      // Clear search
      await searchInput.clear()

      // Verify all integrations are back
      await expect(page.getByText('GitHub').first()).toBeVisible()
      await expect(page.getByText('Slack').first()).toBeVisible()
      await expect(page.getByText('Stripe').first()).toBeVisible()
    })
  })

  test.describe('Integration Category Filter Journey', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test.afterEach(async ({ page }) => {
      await closeAllDialogs(page)
    })

    test('should filter by Communication category', async ({ page }) => {
      await page.goto('/integrations')

      // Click Communication category
      await page.getByRole('button', { name: 'Communication' }).click()

      // Verify only communication integrations are visible
      await expect(page.getByText('Slack').first()).toBeVisible()
      await expect(page.getByText('Discord').first()).toBeVisible()

      // Verify other categories are not visible
      await expect(page.getByText('Stripe').first()).not.toBeVisible()
      await expect(page.getByText('GitHub').first()).not.toBeVisible()
    })

    test('should filter by Development category', async ({ page }) => {
      await page.goto('/integrations')

      // Click Development category
      await page.getByRole('button', { name: 'Development' }).click()

      // Verify only development integrations are visible
      await expect(page.getByText('GitHub').first()).toBeVisible()
      await expect(page.getByText('Linear').first()).toBeVisible()

      // Verify other categories are not visible
      await expect(page.getByText('Slack').first()).not.toBeVisible()
      await expect(page.getByText('Stripe').first()).not.toBeVisible()
    })

    test('should return to all integrations when All is clicked', async ({ page }) => {
      await page.goto('/integrations')

      // First filter by a category
      await page.getByRole('button', { name: 'Payments' }).click()
      await expect(page.getByText('Stripe').first()).toBeVisible()
      await expect(page.getByText('Slack').first()).not.toBeVisible()

      // Click All to reset filter
      await page.getByRole('button', { name: 'All' }).click()

      // Verify all integrations are visible
      await expect(page.getByText('Stripe').first()).toBeVisible()
      await expect(page.getByText('Slack').first()).toBeVisible()
      await expect(page.getByText('GitHub').first()).toBeVisible()
    })
  })

  test.describe('Webhook Management Journey', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test.afterEach(async ({ page }) => {
      await closeAllDialogs(page)
    })

    test('should display webhooks section', async ({ page }) => {
      await page.goto('/integrations')

      // Verify Webhooks heading
      await expect(page.getByRole('heading', { name: /webhooks/i })).toBeVisible()

      // Verify webhooks description
      await expect(page.getByText(/receive real-time notifications when events happen/i)).toBeVisible()

      // Verify Add Webhook button
      const addWebhookButton = page.getByRole('button', { name: 'Add Webhook' }).first()
      await expect(addWebhookButton).toBeVisible()
    })

    test('should display existing webhook details', async ({ page }) => {
      await page.goto('/integrations')

      // Verify webhook URL is displayed
      await expect(page.getByText('https://api.example.com/webhooks/receive')).toBeVisible()

      // Verify event badges are shown
      await expect(page.getByText('user.created')).toBeVisible()
      await expect(page.getByText('user.updated')).toBeVisible()

      // Verify last delivery info
      await expect(page.getByText(/last delivery/i)).toBeVisible()
    })

    test('should open create webhook dialog', async ({ page }) => {
      await page.goto('/integrations')

      // Click Add Webhook button
      const addWebhookButton = page.getByRole('button', { name: 'Add Webhook' }).first()
      await addWebhookButton.click()

      // Verify dialog opens
      await expect(page.getByRole('heading', { name: /create webhook/i })).toBeVisible()

      // Verify dialog description
      await expect(page.getByText(/configure a url to receive post requests/i)).toBeVisible()
    })

    test('should display webhook form fields', async ({ page }) => {
      await page.goto('/integrations')

      // Open dialog
      await page.getByRole('button', { name: 'Add Webhook' }).first().click()

      // Verify Endpoint URL field
      await expect(page.getByLabel(/endpoint url/i)).toBeVisible()
      await expect(page.getByPlaceholder('https://api.example.com/webhooks')).toBeVisible()

      // Verify Events section
      await expect(page.getByText(/events to subscribe/i)).toBeVisible()

      // Verify event buttons
      await expect(page.getByRole('button', { name: 'User Created' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'User Updated' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'User Deleted' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Team Member Added' })).toBeVisible()
    })

    test('should enable create button when form is valid', async ({ page }) => {
      await page.goto('/integrations')

      // Open dialog
      await page.getByRole('button', { name: 'Add Webhook' }).first().click()

      // Verify Create button is initially disabled
      const createButton = page.getByRole('button', { name: 'Create Webhook', exact: true })
      await expect(createButton).toBeDisabled()

      // Fill in URL
      await page.getByPlaceholder('https://api.example.com/webhooks').fill('https://test.example.com/webhook')

      // Still disabled (no events selected)
      await expect(createButton).toBeDisabled()

      // Select an event
      await page.getByRole('button', { name: 'User Created' }).click()

      // Now button should be enabled
      await expect(createButton).toBeEnabled()
    })

    test('should cancel webhook creation', async ({ page }) => {
      await page.goto('/integrations')

      // Open dialog
      await page.getByRole('button', { name: 'Add Webhook' }).first().click()
      await expect(page.getByRole('heading', { name: /create webhook/i })).toBeVisible()

      // Fill in form
      await page.getByPlaceholder('https://api.example.com/webhooks').fill('https://cancel-test.com/webhook')
      await page.getByRole('button', { name: 'User Created' }).click()

      // Click Cancel
      await page.getByRole('button', { name: 'Cancel' }).click()

      // Verify dialog is closed
      await expect(page.getByRole('heading', { name: /create webhook/i })).not.toBeVisible()

      // Verify we're still on integrations page
      await expect(page.getByRole('heading', { name: 'Integrations', exact: true })).toBeVisible()
    })
  })

  test.describe('API Documentation Journey', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test.afterEach(async ({ page }) => {
      await closeAllDialogs(page)
    })

    test('should display API documentation section', async ({ page }) => {
      await page.goto('/integrations')

      // Verify Build Custom Integrations section
      await expect(page.getByText('Build Custom Integrations')).toBeVisible()
      await expect(page.getByText(/use our api to build your own integrations/i)).toBeVisible()

      // Verify View API Docs button
      const apiDocsButton = page.getByRole('button', { name: /view api docs/i })
      await expect(apiDocsButton).toBeVisible()
      await expect(apiDocsButton).toBeEnabled()
    })
  })

  test.describe('Integration Navigation Journey', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test.afterEach(async ({ page }) => {
      await closeAllDialogs(page)
    })

    test('should navigate from integrations to other pages and back', async ({ page }) => {
      // Start at integrations
      await page.goto('/integrations')
      await expect(page.getByRole('heading', { name: 'Integrations', exact: true })).toBeVisible()

      // Navigate to dashboard
      await page.goto('/dashboard')
      await expect(page).toHaveURL(/dashboard/)

      // Return to integrations
      await page.goto('/integrations')
      await expect(page.getByRole('heading', { name: 'Integrations', exact: true })).toBeVisible()

      // Navigate to team
      await page.goto('/team')
      await expect(page.getByRole('heading', { name: /team members/i })).toBeVisible()

      // Return to integrations
      await page.goto('/integrations')
      await expect(page.getByRole('heading', { name: 'Integrations', exact: true })).toBeVisible()
    })
  })
})
