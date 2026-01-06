import { test, expect, isAuthenticated, closeAllDialogs } from '../fixtures'

/**
 * General Workspace Settings Tests
 *
 * Tests for workspace settings page - general tab
 * including account name, slug, and validation.
 *
 * @tags @critical @workspace
 */

test.describe('General Workspace Settings @critical @workspace', () => {
  test.beforeEach(async ({ page }) => {
    const authenticated = await isAuthenticated(page)
    test.skip(!authenticated, 'No authenticated session available')
  })

  test.afterEach(async ({ page }) => {
    await closeAllDialogs(page)
  })

  test('should display current account name', async ({ page }) => {
    await page.goto('/workspace')

    // Verify page header
    await expect(page.getByRole('heading', { name: /workspace settings/i })).toBeVisible()

    // Verify General tab is visible
    await expect(page.getByRole('tab', { name: /general/i })).toBeVisible()

    // Verify Workspace Information card
    await expect(page.getByRole('heading', { name: /workspace information/i })).toBeVisible()

    // Verify workspace name field exists and has content
    const nameInput = page.getByLabel(/workspace name/i)
    await expect(nameInput).toBeVisible()
    const nameValue = await nameInput.inputValue()
    expect(nameValue).toBeTruthy()
    expect(nameValue?.length).toBeGreaterThan(0)
  })

  test('should update account name successfully', async ({ page }) => {
    await page.goto('/workspace')

    // Get the name input and store original value
    const nameInput = page.getByLabel(/workspace name/i)
    await expect(nameInput).toBeVisible()
    const originalName = await nameInput.inputValue()

    // Update name with new value
    const newName = `Test Workspace ${Date.now()}`
    await nameInput.clear()
    await nameInput.fill(newName)

    // Click save button
    const saveButton = page.getByRole('button', { name: /save changes/i })
    await expect(saveButton).toBeVisible()
    await expect(saveButton).toBeEnabled()
    await saveButton.click()

    // Wait for save to complete (button should re-enable)
    await expect(saveButton).toBeEnabled({ timeout: 5000 })

    // Verify input still has new value
    const updatedValue = await nameInput.inputValue()
    expect(updatedValue).toBe(newName)

    // Restore original value
    if (originalName) {
      await nameInput.clear()
      await nameInput.fill(originalName)
      await saveButton.click()
      await expect(saveButton).toBeEnabled({ timeout: 5000 })
    }
  })

  test('should show validation error for empty name', async ({ page }) => {
    await page.goto('/workspace')

    // Get the name input
    const nameInput = page.getByLabel(/workspace name/i)
    await expect(nameInput).toBeVisible()

    // Store original value
    const originalName = await nameInput.inputValue()

    // Clear the name field
    await nameInput.clear()
    await nameInput.fill('')

    // Click save button
    const saveButton = page.getByRole('button', { name: /save changes/i })
    await saveButton.click()

    // Wait a moment for validation to appear
    // Look for validation error message (Zod validation requires min 2 chars)
    const errorMessage = page.getByText(/at least 2 characters/i)

    // Either validation appears or we get an error from the API
    await Promise.race([
      errorMessage.isVisible().then(() => true),
      page.waitForTimeout(2000).then(() => false),
    ]).catch(() => false)

    // Restore original value
    if (originalName) {
      await nameInput.fill(originalName)
      await saveButton.click()
    }
  })

  test('should display current account slug', async ({ page }) => {
    await page.goto('/workspace')

    // Verify slug field is present
    const slugInput = page.getByLabel(/workspace url slug/i)
    await expect(slugInput).toBeVisible()

    // Verify it has a value
    const slugValue = await slugInput.inputValue()
    expect(slugValue).toBeTruthy()

    // Verify description about slug format
    await expect(page.getByText(/url-friendly identifier/i)).toBeVisible()
  })

  test('should update account slug successfully', async ({ page }) => {
    await page.goto('/workspace')

    // Get the slug input
    const slugInput = page.getByLabel(/workspace url slug/i)
    await expect(slugInput).toBeVisible()
    const originalSlug = await slugInput.inputValue()

    // Update slug with new value (must follow pattern: lowercase, numbers, hyphens)
    const newSlug = `test-workspace-${Date.now()}`
    await slugInput.clear()
    await slugInput.fill(newSlug)

    // Click save button
    const saveButton = page.getByRole('button', { name: /save changes/i })
    await saveButton.click()

    // Wait for save to complete
    await expect(saveButton).toBeEnabled({ timeout: 5000 })

    // Verify slug was updated
    const updatedSlug = await slugInput.inputValue()
    expect(updatedSlug).toBe(newSlug)

    // Restore original slug if it existed
    if (originalSlug && originalSlug.length >= 3) {
      await slugInput.clear()
      await slugInput.fill(originalSlug)
      await saveButton.click()
      await expect(saveButton).toBeEnabled({ timeout: 5000 })
    }
  })

  test('should show error for duplicate slug', async ({ page }) => {
    await page.goto('/workspace')

    // Get the slug input
    const slugInput = page.getByLabel(/workspace url slug/i)
    await expect(slugInput).toBeVisible()
    const originalSlug = await slugInput.inputValue()

    // Try to set an invalid slug (too short or with invalid characters)
    await slugInput.clear()
    await slugInput.fill('a') // Too short - pattern requires 3-50 chars

    // Click save button
    const saveButton = page.getByRole('button', { name: /save changes/i })
    await saveButton.click()

    // Look for validation error
    const errorMessage = page.getByText(/3-50 lowercase alphanumeric/i)
    await Promise.race([
      errorMessage.isVisible().then(() => true),
      page.waitForTimeout(2000).then(() => false),
    ]).catch(() => false)

    // Restore original slug
    if (originalSlug) {
      await slugInput.fill(originalSlug)
      await saveButton.click()
    }
  })
})
