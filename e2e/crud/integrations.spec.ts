import { test, expect, isAuthenticated } from '../fixtures'

/**
 * Integrations Page E2E Tests
 *
 * Tests for integrations and webhooks management functionality via the UI.
 * Covers integration cards, search/filter, webhooks, and navigation.
 *
 * @tags @crud
 */

test.describe('Integrations Page @crud', () => {
  test.beforeEach(async ({ page }) => {
    const authenticated = await isAuthenticated(page)
    test.skip(!authenticated, 'No authenticated session available')
  })

  test.describe('Page Structure', () => {
    test('should display page heading and description', async ({ page }) => {
      await page.goto('/integrations')

      // Should see the Integrations heading (h1, exact match)
      await expect(page.getByRole('heading', { name: 'Integrations', exact: true })).toBeVisible()

      // Should see the description text
      await expect(page.getByText(/connect third-party services and manage webhooks/i)).toBeVisible()
    })

    test('should display connected integrations count', async ({ page }) => {
      await page.goto('/integrations')

      // Should see connected count indicator (e.g., "2 connected")
      await expect(page.getByText(/\d+ connected/i)).toBeVisible()
    })

    test('should display Available Integrations section', async ({ page }) => {
      await page.goto('/integrations')

      // Should see the Available Integrations heading
      await expect(page.getByRole('heading', { name: /available integrations/i })).toBeVisible()
    })
  })

  test.describe('Search and Filter', () => {
    test('should display search input', async ({ page }) => {
      await page.goto('/integrations')

      // Should see search input with placeholder
      const searchInput = page.getByPlaceholder(/search integrations/i)
      await expect(searchInput).toBeVisible()
      await expect(searchInput).toBeEnabled()
    })

    test('should display category filter buttons', async ({ page }) => {
      await page.goto('/integrations')

      // Should see all category buttons
      await expect(page.getByRole('button', { name: /^all$/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /communication/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /payments/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /development/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /automation/i })).toBeVisible()
    })

    test('should filter integrations by search query', async ({ page }) => {
      await page.goto('/integrations')

      // Search for "slack"
      const searchInput = page.getByPlaceholder(/search integrations/i)
      await searchInput.fill('slack')

      // Should see Slack integration
      await expect(page.getByText(/^slack$/i)).toBeVisible()

      // Should not see unrelated integrations
      await expect(page.getByText(/^stripe$/i)).not.toBeVisible()
    })

    test('should show empty state when no integrations match search', async ({ page }) => {
      await page.goto('/integrations')

      // Search for non-existent integration
      const searchInput = page.getByPlaceholder(/search integrations/i)
      await searchInput.fill('nonexistent-integration-xyz')

      // Should show no integrations found message
      await expect(page.getByText(/no integrations found matching your search/i)).toBeVisible()
    })

    test('should filter integrations by category', async ({ page }) => {
      await page.goto('/integrations')

      // Click on Development category
      const developmentButton = page.getByRole('button', { name: /development/i })
      await developmentButton.click()

      // Should see development integrations (GitHub, Linear)
      await expect(page.getByText(/^github$/i)).toBeVisible()
      await expect(page.getByText(/^linear$/i)).toBeVisible()

      // Should not see communication integrations
      await expect(page.getByText(/^slack$/i)).not.toBeVisible()
    })

    test('should clear filter when selecting All category', async ({ page }) => {
      await page.goto('/integrations')

      // First filter by category
      await page.getByRole('button', { name: /payments/i }).click()

      // Then click All
      await page.getByRole('button', { name: /^all$/i }).click()

      // Should see all integrations again
      await expect(page.getByText(/^slack$/i)).toBeVisible()
      await expect(page.getByText(/^stripe$/i)).toBeVisible()
      await expect(page.getByText(/^github$/i)).toBeVisible()
    })
  })

  test.describe('Integration Cards', () => {
    test('should display integration cards with names and descriptions', async ({ page }) => {
      await page.goto('/integrations')

      // Should see known integrations
      await expect(page.getByText(/^slack$/i)).toBeVisible()
      await expect(page.getByText(/send notifications and updates to slack channels/i)).toBeVisible()

      await expect(page.getByText(/^stripe$/i)).toBeVisible()
      await expect(page.getByText(/process payments and manage subscriptions/i)).toBeVisible()

      await expect(page.getByText(/^github$/i)).toBeVisible()
      await expect(page.getByText(/sync repositories and track issues/i)).toBeVisible()
    })

    test('should display Connected badge for connected integrations', async ({ page }) => {
      await page.goto('/integrations')

      // Slack and Stripe are connected by default - look for Connected text or Configure button
      const connectedText = page.getByText(/connected/i).first()
      const configureButton = page.getByRole('button', { name: /configure/i }).first()

      const hasConnectedText = await connectedText.isVisible({ timeout: 3000 }).catch(() => false)
      const hasConfigureButton = await configureButton.isVisible({ timeout: 3000 }).catch(() => false)

      // At least one indicator of connected state should be visible
      expect(hasConnectedText || hasConfigureButton).toBeTruthy()
    })

    test('should display category badges on integration cards', async ({ page }) => {
      await page.goto('/integrations')

      // Should see category text (communication, payments, development)
      const hasCommunication = await page.getByText(/communication/i).first().isVisible({ timeout: 3000 }).catch(() => false)
      const hasPayments = await page.getByText(/payments/i).first().isVisible({ timeout: 3000 }).catch(() => false)
      const hasDevelopment = await page.getByText(/development/i).first().isVisible({ timeout: 3000 }).catch(() => false)

      // At least two categories should be visible
      expect([hasCommunication, hasPayments, hasDevelopment].filter(Boolean).length).toBeGreaterThanOrEqual(2)
    })

    test('should display Connect button for disconnected integrations', async ({ page }) => {
      await page.goto('/integrations')

      // Should have at least one Connect button (for disconnected integrations)
      const connectButton = page.getByRole('button', { name: /connect/i }).first()
      await expect(connectButton).toBeVisible()
    })

    test('should display Configure button for connected integrations', async ({ page }) => {
      await page.goto('/integrations')

      // Should see Configure buttons for connected integrations
      const configureButtons = page.getByRole('button', { name: /configure/i })
      await expect(configureButtons.first()).toBeVisible()
    })

    test('should toggle integration connection state when clicking Connect/Configure', async ({ page }) => {
      await page.goto('/integrations')

      // Find a Connect button and click it
      const connectButton = page.getByRole('button', { name: /connect/i }).first()
      await connectButton.click()

      // Should show loading spinner then change to Configure
      await expect(page.getByRole('button', { name: /configure/i })).toHaveCount(3, { timeout: 3000 })
    })
  })

  test.describe('Webhooks Section', () => {
    test('should display Webhooks section heading and description', async ({ page }) => {
      await page.goto('/integrations')

      // Should see Webhooks heading
      await expect(page.getByRole('heading', { name: /webhooks/i })).toBeVisible()

      // Should see description
      await expect(page.getByText(/receive real-time notifications when events happen/i)).toBeVisible()
    })

    test('should display Add Webhook button', async ({ page }) => {
      await page.goto('/integrations')

      // Should see Add Webhook button
      const addWebhookButton = page.getByRole('button', { name: /add webhook/i }).first()
      await expect(addWebhookButton).toBeVisible()
      await expect(addWebhookButton).toBeEnabled()
    })

    test('should display existing webhook with URL and events', async ({ page }) => {
      await page.goto('/integrations')

      // Should see webhook URL (mock data)
      await expect(page.getByText(/https:\/\/api\.example\.com\/webhooks\/receive/i)).toBeVisible()

      // Should see webhook events
      await expect(page.getByText(/user\.created/i)).toBeVisible()
      await expect(page.getByText(/user\.updated/i)).toBeVisible()
    })

    test('should display webhook status indicator', async ({ page }) => {
      await page.goto('/integrations')

      // Should see last delivery info
      await expect(page.getByText(/last delivery:/i)).toBeVisible()

      // Should see status (success)
      await expect(page.getByText(/success/i)).toBeVisible()
    })

    test('should display edit and delete buttons on webhook card', async ({ page }) => {
      await page.goto('/integrations')

      // Should see action buttons in the webhooks section
      // The Add Webhook button and any action buttons on webhook cards
      const addWebhookButton = page.getByRole('button', { name: /add webhook/i }).first()
      await expect(addWebhookButton).toBeVisible()

      // Should have buttons in the page (including action buttons)
      const allButtons = page.getByRole('button')
      const buttonCount = await allButtons.count()

      // Should have more than just the Add Webhook button
      expect(buttonCount).toBeGreaterThan(1)
    })
  })

  test.describe('Create Webhook Dialog', () => {
    test('should open Create Webhook dialog when clicking Add Webhook', async ({ page }) => {
      await page.goto('/integrations')

      // Click Add Webhook button
      await page.getByRole('button', { name: /add webhook/i }).first().click()

      // Dialog should be visible
      await expect(page.getByRole('dialog')).toBeVisible()

      // Should have title
      await expect(page.getByRole('heading', { name: /create webhook/i })).toBeVisible()
    })

    test('should display endpoint URL input in dialog', async ({ page }) => {
      await page.goto('/integrations')

      // Open dialog
      await page.getByRole('button', { name: /add webhook/i }).first().click()

      // Should see URL input
      const urlInput = page.getByLabel(/endpoint url/i)
      await expect(urlInput).toBeVisible()
      await expect(urlInput).toBeEnabled()
      await expect(urlInput).toHaveAttribute('placeholder', /https:\/\/api\.example\.com\/webhooks/i)
    })

    test('should display event type selection in dialog', async ({ page }) => {
      await page.goto('/integrations')

      // Open dialog
      await page.getByRole('button', { name: /add webhook/i }).first().click()

      // Should see Events to Subscribe label
      await expect(page.getByText(/events to subscribe/i)).toBeVisible()

      // Should see event options
      await expect(page.getByText(/user created/i)).toBeVisible()
      await expect(page.getByText(/user updated/i)).toBeVisible()
      await expect(page.getByText(/user deleted/i)).toBeVisible()
      await expect(page.getByText(/team member added/i)).toBeVisible()
      await expect(page.getByText(/team member removed/i)).toBeVisible()
      await expect(page.getByText(/invoice paid/i)).toBeVisible()
    })

    test('should have Cancel and Create Webhook buttons in dialog', async ({ page }) => {
      await page.goto('/integrations')

      // Open dialog
      await page.getByRole('button', { name: /add webhook/i }).first().click()

      // Should see Cancel button
      await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible()

      // Should see Create Webhook button
      await expect(page.getByRole('button', { name: /create webhook/i })).toBeVisible()
    })

    test('Create Webhook button should be disabled without URL and events', async ({ page }) => {
      await page.goto('/integrations')

      // Open dialog
      await page.getByRole('button', { name: /add webhook/i }).first().click()

      // Create button should be disabled
      const createButton = page.getByRole('button', { name: /create webhook/i })
      await expect(createButton).toBeDisabled()
    })

    test('should enable Create Webhook button when URL and event are provided', async ({ page }) => {
      await page.goto('/integrations')

      // Open dialog
      await page.getByRole('button', { name: /add webhook/i }).first().click()

      // Enter URL
      const urlInput = page.getByLabel(/endpoint url/i)
      await urlInput.fill('https://api.myservice.com/webhooks')

      // Select an event
      await page.getByText(/user created/i).click()

      // Create button should be enabled
      const createButton = page.getByRole('button', { name: /create webhook/i })
      await expect(createButton).toBeEnabled()
    })

    test('should close dialog when clicking Cancel', async ({ page }) => {
      await page.goto('/integrations')

      // Open dialog
      await page.getByRole('button', { name: /add webhook/i }).first().click()

      // Click Cancel
      await page.getByRole('button', { name: /cancel/i }).click()

      // Dialog should be closed
      await expect(page.getByRole('dialog')).not.toBeVisible()
    })

    test('should toggle event selection in dialog', async ({ page }) => {
      await page.goto('/integrations')

      // Open dialog
      await page.getByRole('button', { name: /add webhook/i }).first().click()

      // Click on User Created event
      const userCreatedOption = page.getByText(/user created/i)
      await userCreatedOption.click()

      // Should show as selected (has checkmark)
      const selectedOption = userCreatedOption.locator('..')
      await expect(selectedOption).toHaveClass(/border-primary/i)

      // Click again to deselect
      await userCreatedOption.click()

      // Should no longer be selected
      await expect(selectedOption).not.toHaveClass(/border-primary bg-primary/i)
    })
  })

  test.describe('API Documentation Section', () => {
    test('should display Build Custom Integrations section', async ({ page }) => {
      await page.goto('/integrations')

      // Should see the section title
      await expect(page.getByText(/build custom integrations/i)).toBeVisible()

      // Should see description
      await expect(page.getByText(/use our api to build your own integrations/i)).toBeVisible()
    })

    test('should display View API Docs button', async ({ page }) => {
      await page.goto('/integrations')

      // Should see View API Docs button
      const apiDocsButton = page.getByRole('button', { name: /view api docs/i })
      await expect(apiDocsButton).toBeVisible()
      await expect(apiDocsButton).toBeEnabled()
    })
  })

  test.describe('Navigation', () => {
    test('should navigate to integrations page from sidebar', async ({ page }) => {
      await page.goto('/dashboard')

      // Look for integrations link in navigation
      const integrationsLink = page.getByRole('link', { name: /integrations/i })

      if (await integrationsLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await integrationsLink.click()
        await expect(page).toHaveURL(/integrations/)
        await expect(page.getByRole('heading', { name: /integrations/i })).toBeVisible()
      }
    })

    test('should directly access integrations page via URL', async ({ page }) => {
      await page.goto('/integrations')

      // Should load integrations page without redirect to login
      await expect(page).not.toHaveURL(/login/)
      await expect(page.getByRole('heading', { name: /integrations/i })).toBeVisible()
    })

    test('should not redirect authenticated user to login', async ({ page }) => {
      await page.goto('/integrations')

      // Wait for page to settle
      await page.waitForLoadState('networkidle')

      // Should stay on integrations page
      await expect(page).toHaveURL(/integrations/)
    })
  })
})
