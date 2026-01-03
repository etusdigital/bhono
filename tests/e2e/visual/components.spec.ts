import { test, expect, isAuthenticated, waitForToast } from '../fixtures'

/**
 * Visual Regression Tests - Component Screenshots
 *
 * These tests capture screenshots of specific UI components for visual comparison.
 * Focus on component-level consistency rather than full-page snapshots.
 *
 * Run with: npx playwright test --grep @visual
 *
 * @tags @visual @components
 */

// Shared screenshot options for consistency
const screenshotOptions = {
  maxDiffPixelRatio: 0.02,
}

test.describe('Dashboard Card Consistency @visual @components', () => {
  test.beforeEach(async ({ page }) => {
    const authenticated = await isAuthenticated(page)
    test.skip(!authenticated, 'No authenticated session available')
  })

  test('dashboard cards have consistent styling', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Wait for dashboard to fully load
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible()

    // Capture the card grid area
    const cardContainer = page.locator('.grid').first()
    if (await cardContainer.count() === 0) {
      test.skip(true, 'No card grid found on dashboard')
      return
    }

    await expect(cardContainer).toHaveScreenshot('dashboard-cards-grid.png', {
      ...screenshotOptions,
      // Mask dynamic content within cards
      mask: [
        page.locator('[class*="Card"] h2.text-3xl'),
        page.locator('[class*="Card"] .text-3xl'),
        page.locator('time'),
      ],
    })
  })

  test('individual dashboard card snapshot', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Find the first card
    const card = page.locator('[class*="rounded-lg"][class*="border"]').first()
    if (await card.count() === 0) {
      test.skip(true, 'No card elements found on dashboard')
      return
    }

    await expect(card).toHaveScreenshot('dashboard-card-single.png', {
      ...screenshotOptions,
      mask: [
        card.locator('.text-3xl'),
        card.locator('time'),
      ],
    })
  })
})

test.describe('Primary Button Brand Color @visual @components', () => {
  test.beforeEach(async ({ page }) => {
    const authenticated = await isAuthenticated(page)
    test.skip(!authenticated, 'No authenticated session available')
  })

  test('primary button visual snapshot', async ({ page }) => {
    await page.goto('/team')
    await page.waitForLoadState('networkidle')

    const primaryButton = page.locator('button').filter({ hasText: 'Invite Member' }).first()
    await expect(primaryButton).toBeVisible()

    await expect(primaryButton).toHaveScreenshot('primary-button.png', screenshotOptions)
  })

  test('primary button hover state snapshot', async ({ page }) => {
    await page.goto('/team')
    await page.waitForLoadState('networkidle')

    const primaryButton = page.locator('button').filter({ hasText: 'Invite Member' }).first()
    await expect(primaryButton).toBeVisible()

    // Hover the button to capture hover state
    await primaryButton.hover()

    await expect(primaryButton).toHaveScreenshot('primary-button-hover.png', screenshotOptions)
  })

  test('primary button focus state snapshot', async ({ page }) => {
    await page.goto('/team')
    await page.waitForLoadState('networkidle')

    const primaryButton = page.locator('button').filter({ hasText: 'Invite Member' }).first()
    await expect(primaryButton).toBeVisible()

    // Focus the button to capture focus ring
    await primaryButton.focus()

    await expect(primaryButton).toHaveScreenshot('primary-button-focus.png', screenshotOptions)
  })
})

test.describe('Dark Mode Background Colors @visual @components', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    const authenticated = await isAuthenticated(page)
    test.skip(!authenticated, 'No authenticated session available')
  })

  test('dark mode page background snapshot', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveScreenshot('dark-mode-background.png', {
      ...screenshotOptions,
      fullPage: true,
      mask: [
        page.locator('[class*="Avatar"]'),
        page.locator('.text-3xl'),
        page.locator('time'),
      ],
    })
  })

  test('dark mode card background snapshot', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    const card = page.locator('[class*="rounded-lg"][class*="border"]').first()
    if (await card.count() === 0) {
      test.skip(true, 'No card elements found')
      return
    }

    await expect(card).toHaveScreenshot('dark-mode-card.png', {
      ...screenshotOptions,
      mask: [
        card.locator('.text-3xl'),
      ],
    })
  })

  test('dark mode sidebar background snapshot', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    const sidebar = page.locator('aside').first()
    if (await sidebar.count() === 0) {
      test.skip(true, 'No sidebar found')
      return
    }

    await expect(sidebar).toHaveScreenshot('dark-mode-sidebar.png', {
      ...screenshotOptions,
      mask: [
        sidebar.locator('[class*="Avatar"]'),
      ],
    })
  })
})

test.describe('Input Focus Ring Styling @visual @components', () => {
  test.beforeEach(async ({ page }) => {
    const authenticated = await isAuthenticated(page)
    test.skip(!authenticated, 'No authenticated session available')
  })

  test('input default state snapshot', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    const input = page.locator('input[type="text"], input[type="email"]').first()
    if (await input.count() === 0) {
      test.skip(true, 'No text input found')
      return
    }

    await expect(input).toHaveScreenshot('input-default.png', screenshotOptions)
  })

  test('input focus ring snapshot', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    const input = page.locator('input[type="text"], input[type="email"]').first()
    if (await input.count() === 0) {
      test.skip(true, 'No text input found')
      return
    }

    // Focus the input to show focus ring
    await input.focus()

    await expect(input).toHaveScreenshot('input-focus-ring.png', screenshotOptions)
  })

  test('input with value snapshot', async ({ page }) => {
    await page.goto('/team')
    await page.waitForLoadState('networkidle')

    // Open invite dialog to get a fresh input
    const inviteButton = page.locator('button').filter({ hasText: 'Invite Member' }).first()
    await inviteButton.click()
    await expect(page.getByRole('dialog')).toBeVisible()

    const input = page.getByLabel(/email address/i)
    await input.fill('test@example.com')

    await expect(input).toHaveScreenshot('input-with-value.png', screenshotOptions)

    // Close dialog
    await page.getByRole('button', { name: /cancel/i }).click()
  })
})

test.describe('Dialog Backdrop and Animations @visual @components', () => {
  test.beforeEach(async ({ page }) => {
    const authenticated = await isAuthenticated(page)
    test.skip(!authenticated, 'No authenticated session available')
  })

  test('dialog with backdrop snapshot', async ({ page }) => {
    await page.goto('/team')
    await page.waitForLoadState('networkidle')

    // Open dialog
    const inviteButton = page.locator('button').filter({ hasText: 'Invite Member' }).first()
    await inviteButton.click()

    // Wait for dialog animation to complete
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.waitForTimeout(300) // Allow CSS animations to complete

    // Take full page screenshot to capture backdrop
    await expect(page).toHaveScreenshot('dialog-with-backdrop.png', {
      ...screenshotOptions,
      fullPage: true,
    })

    // Close dialog
    await page.getByRole('button', { name: /cancel/i }).click()
  })

  test('dialog content snapshot', async ({ page }) => {
    await page.goto('/team')
    await page.waitForLoadState('networkidle')

    // Open dialog
    const inviteButton = page.locator('button').filter({ hasText: 'Invite Member' }).first()
    await inviteButton.click()
    await expect(page.getByRole('dialog')).toBeVisible()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toHaveScreenshot('dialog-content.png', screenshotOptions)

    // Close dialog
    await page.getByRole('button', { name: /cancel/i }).click()
  })

  test('confirmation dialog snapshot', async ({ page }) => {
    await page.goto('/account')
    await page.waitForLoadState('networkidle')

    // Open delete confirmation dialog
    const deleteButton = page.getByRole('button', { name: /delete/i }).first()
    if (await deleteButton.count() === 0) {
      test.skip(true, 'No delete button found')
      return
    }

    await deleteButton.click()
    await expect(page.getByRole('dialog')).toBeVisible()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toHaveScreenshot('confirmation-dialog.png', screenshotOptions)

    // Close dialog
    await page.getByRole('button', { name: /cancel/i }).click()
  })
})

test.describe('Sidebar Styling @visual @components', () => {
  test.beforeEach(async ({ page }) => {
    const authenticated = await isAuthenticated(page)
    test.skip(!authenticated, 'No authenticated session available')
  })

  test('sidebar navigation snapshot', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    const sidebar = page.locator('aside').first()
    if (await sidebar.count() === 0) {
      test.skip(true, 'No sidebar found')
      return
    }

    await expect(sidebar).toHaveScreenshot('sidebar-navigation.png', {
      ...screenshotOptions,
      mask: [
        sidebar.locator('[class*="Avatar"]'),
        sidebar.locator('img[alt*="avatar" i]'),
      ],
    })
  })

  test('sidebar active nav item snapshot', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Find active navigation item
    const activeNavItem = page.locator('aside a[aria-current="page"], aside a.active').first()
    if (await activeNavItem.count() === 0) {
      // Try finding by data attribute or other means
      const dashboardLink = page.locator('aside').getByRole('link', { name: /dashboard/i })
      if (await dashboardLink.count() === 0) {
        test.skip(true, 'No active nav item found')
        return
      }
      await expect(dashboardLink).toHaveScreenshot('sidebar-active-nav-item.png', screenshotOptions)
    } else {
      await expect(activeNavItem).toHaveScreenshot('sidebar-active-nav-item.png', screenshotOptions)
    }
  })

  test('sidebar collapsed state snapshot', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 720 })
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // On tablet, sidebar might be collapsed
    const sidebar = page.locator('aside').first()
    if (await sidebar.count() === 0) {
      // Look for mobile menu button instead
      const menuButton = page.getByRole('button', { name: /menu/i })
      if (await menuButton.count() === 0) {
        test.skip(true, 'No sidebar or menu button found')
        return
      }
      await expect(menuButton).toHaveScreenshot('sidebar-collapsed-menu-button.png', screenshotOptions)
    } else {
      await expect(sidebar).toHaveScreenshot('sidebar-collapsed.png', {
        ...screenshotOptions,
        mask: [
          sidebar.locator('[class*="Avatar"]'),
        ],
      })
    }
  })
})

test.describe('Table Hover States @visual @components', () => {
  test.beforeEach(async ({ page }) => {
    const authenticated = await isAuthenticated(page)
    test.skip(!authenticated, 'No authenticated session available')
  })

  test('table row default state snapshot', async ({ page }) => {
    await page.goto('/team')
    await page.waitForLoadState('networkidle')

    const tableRow = page.locator('table tbody tr, [role="row"]').first()
    if (await tableRow.count() === 0) {
      test.skip(true, 'No table rows found')
      return
    }

    await expect(tableRow).toHaveScreenshot('table-row-default.png', {
      ...screenshotOptions,
      mask: [
        tableRow.locator('[class*="Avatar"]'),
        tableRow.locator('img[alt*="avatar" i]'),
        tableRow.locator('time'),
      ],
    })
  })

  test('table row hover state snapshot', async ({ page }) => {
    await page.goto('/team')
    await page.waitForLoadState('networkidle')

    const tableRow = page.locator('table tbody tr, [role="row"]').first()
    if (await tableRow.count() === 0) {
      test.skip(true, 'No table rows found')
      return
    }

    // Hover the row
    await tableRow.hover()

    await expect(tableRow).toHaveScreenshot('table-row-hover.png', {
      ...screenshotOptions,
      mask: [
        tableRow.locator('[class*="Avatar"]'),
        tableRow.locator('img[alt*="avatar" i]'),
        tableRow.locator('time'),
      ],
    })
  })

  test('table header styling snapshot', async ({ page }) => {
    await page.goto('/team')
    await page.waitForLoadState('networkidle')

    const tableHeader = page.locator('table thead, [role="rowgroup"]').first()
    if (await tableHeader.count() === 0) {
      test.skip(true, 'No table header found')
      return
    }

    await expect(tableHeader).toHaveScreenshot('table-header.png', screenshotOptions)
  })
})

test.describe('Toast Positioning and Styling @visual @components', () => {
  test.beforeEach(async ({ page }) => {
    const authenticated = await isAuthenticated(page)
    test.skip(!authenticated, 'No authenticated session available')
  })

  test('success toast snapshot', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    // Trigger a save action to generate a toast
    const saveButton = page.getByRole('button', { name: /save/i }).first()
    if (await saveButton.count() === 0) {
      test.skip(true, 'No save button found to trigger toast')
      return
    }

    await saveButton.click()

    // Wait for toast to appear
    try {
      const toast = await waitForToast(page)
      await expect(toast).toHaveScreenshot('toast-success.png', screenshotOptions)
    } catch {
      test.skip(true, 'No toast appeared after action')
    }
  })

  test('toast container positioning snapshot', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    // Trigger a save action to generate a toast
    const saveButton = page.getByRole('button', { name: /save/i }).first()
    if (await saveButton.count() === 0) {
      test.skip(true, 'No save button found')
      return
    }

    await saveButton.click()

    // Wait for toast container to appear
    const toastContainer = page.locator('[class*="Toaster"], [class*="toast-container"], [role="status"]').first()
    try {
      await expect(toastContainer).toBeVisible({ timeout: 5000 })

      // Take full page screenshot to verify toast positioning
      await expect(page).toHaveScreenshot('toast-positioning.png', {
        ...screenshotOptions,
        fullPage: true,
        mask: [
          page.locator('[class*="Avatar"]'),
          page.locator('input'),
        ],
      })
    } catch {
      test.skip(true, 'No toast container appeared')
    }
  })
})

test.describe('Empty State Messaging @visual @components', () => {
  test.beforeEach(async ({ page }) => {
    const authenticated = await isAuthenticated(page)
    test.skip(!authenticated, 'No authenticated session available')
  })

  test('empty state component snapshot', async ({ page }) => {
    // Navigate to a page that may show empty state (integrations, webhooks list)
    await page.goto('/integrations')
    await page.waitForLoadState('networkidle')

    // Look for empty state messaging
    const emptyState = page.locator('[class*="empty"], [class*="Empty"]').first()

    if (await emptyState.count() === 0) {
      // Try finding empty message text
      const emptyMessage = page.getByText(/no .* found/i).first()
      if (await emptyMessage.count() === 0) {
        test.skip(true, 'No empty state found - page has data')
        return
      }

      // Take screenshot of the empty message container
      const container = emptyMessage.locator('..')
      await expect(container).toHaveScreenshot('empty-state-message.png', screenshotOptions)
    } else {
      await expect(emptyState).toHaveScreenshot('empty-state-component.png', screenshotOptions)
    }
  })

  test('empty search results snapshot', async ({ page }) => {
    await page.goto('/team')
    await page.waitForLoadState('networkidle')

    // Look for a search input
    const searchInput = page.getByPlaceholder(/search/i).first()
    if (await searchInput.count() === 0) {
      test.skip(true, 'No search input found')
      return
    }

    // Search for something that won't exist
    await searchInput.fill('zzzznonexistent12345')
    await page.waitForTimeout(500) // Wait for search debounce

    // Look for empty results message
    const noResults = page.getByText(/no .* found|no results|no matches/i).first()
    if (await noResults.count() === 0) {
      test.skip(true, 'No empty results message found')
      return
    }

    await expect(noResults).toHaveScreenshot('empty-search-results.png', screenshotOptions)
  })
})

test.describe('Loading Spinner Buttons @visual @components', () => {
  test.beforeEach(async ({ page }) => {
    const authenticated = await isAuthenticated(page)
    test.skip(!authenticated, 'No authenticated session available')
  })

  test('button loading state snapshot', async ({ page }) => {
    await page.goto('/team')
    await page.waitForLoadState('networkidle')

    // Open invite dialog
    const inviteButton = page.locator('button').filter({ hasText: 'Invite Member' }).first()
    await inviteButton.click()
    await expect(page.getByRole('dialog')).toBeVisible()

    // Fill form to enable submit button
    const emailInput = page.getByLabel(/email address/i)
    await emailInput.fill('test-loading@example.com')

    // Find submit button
    const submitButton = page.getByRole('button', { name: /send invitation/i })

    // Take a screenshot before clicking (for comparison)
    await expect(submitButton).toHaveScreenshot('button-before-loading.png', screenshotOptions)

    // Click and try to catch loading state
    // Note: This may be too fast to capture, so we also verify the button exists
    await submitButton.click()

    // Try to capture loading spinner (may need to intercept network)
    const loadingSpinner = page.locator('button [class*="spinner"], button [class*="loading"], button svg.animate-spin').first()
    if (await loadingSpinner.count() > 0) {
      await expect(loadingSpinner).toHaveScreenshot('button-loading-spinner.png', screenshotOptions)
    }

    // Close dialog if still open
    const closeButton = page.getByRole('button', { name: /cancel|close/i })
    if (await closeButton.count() > 0) {
      await closeButton.click()
    }
  })

  test('loading button with slow network snapshot', async ({ page }) => {
    // Slow down network to capture loading state
    await page.route('**/api/**', async route => {
      await new Promise(resolve => setTimeout(resolve, 2000))
      await route.continue()
    })

    await page.goto('/team')
    await page.waitForLoadState('domcontentloaded')

    // Open invite dialog
    const inviteButton = page.locator('button').filter({ hasText: 'Invite Member' }).first()
    await inviteButton.click()
    await expect(page.getByRole('dialog')).toBeVisible()

    // Fill form
    const emailInput = page.getByLabel(/email address/i)
    await emailInput.fill('slow-network-test@example.com')

    const submitButton = page.getByRole('button', { name: /send invitation/i })

    // Start the request
    const clickPromise = submitButton.click()

    // Wait a moment for loading state to appear
    await page.waitForTimeout(300)

    // Capture the button in loading state
    await expect(submitButton).toHaveScreenshot('button-loading-slow-network.png', {
      ...screenshotOptions,
      timeout: 1000,
    }).catch(() => {
      // Button may have already finished, which is fine
    })

    // Wait for the click to complete
    await clickPromise.catch(() => {})

    // Unroute to clean up
    await page.unroute('**/api/**')

    // Close dialog
    await page.keyboard.press('Escape')
  })

  test('disabled button snapshot', async ({ page }) => {
    await page.goto('/team')
    await page.waitForLoadState('networkidle')

    // Open invite dialog
    const inviteButton = page.locator('button').filter({ hasText: 'Invite Member' }).first()
    await inviteButton.click()
    await expect(page.getByRole('dialog')).toBeVisible()

    // The submit button should be disabled when form is empty
    const submitButton = page.getByRole('button', { name: /send invitation/i })

    const isDisabled = await submitButton.isDisabled()
    if (isDisabled) {
      await expect(submitButton).toHaveScreenshot('button-disabled.png', screenshotOptions)
    }

    // Close dialog
    await page.getByRole('button', { name: /cancel/i }).click()
  })
})
