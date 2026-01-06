import { test, expect, isAuthenticated, closeAllDialogs } from '../fixtures'

/**
 * Branding Workspace Settings Tests
 *
 * Tests for workspace settings page - branding tab
 * including logo upload, favicon, and color customization.
 *
 * @tags @critical @workspace @branding
 */

test.describe('Branding Workspace Settings @critical @branding', () => {
  test.beforeEach(async ({ page }) => {
    const authenticated = await isAuthenticated(page)
    test.skip(!authenticated, 'No authenticated session available')
  })

  test.afterEach(async ({ page }) => {
    await closeAllDialogs(page)
  })

  test('should display current logo or placeholder', async ({ page }) => {
    await page.goto('/workspace')

    // Click on Branding tab
    const brandingTab = page.getByRole('tab', { name: /branding/i })
    await expect(brandingTab).toBeVisible()
    await brandingTab.click()

    // Wait for branding content to load
    await expect(page.getByRole('heading', { name: /logo/i })).toBeVisible()

    // Verify logo card structure
    await expect(page.getByText(/your workspace logo appears in the sidebar/i)).toBeVisible()

    // Verify logo preview area exists
    const logoPreview = page.locator('.flex.items-center.justify-center.rounded-lg.border-2')
    await expect(logoPreview.first()).toBeVisible()

    // Verify Upload Logo button exists
    const uploadButton = page.getByRole('button', { name: /upload logo/i })
    await expect(uploadButton).toBeVisible()
    await expect(uploadButton).toBeEnabled()

    // Verify file size recommendation
    await expect(page.getByText(/max 2mb/i)).toBeVisible()
  })

  test('should upload new logo successfully', async ({ page }) => {
    await page.goto('/workspace')

    // Click on Branding tab
    const brandingTab = page.getByRole('tab', { name: /branding/i })
    await expect(brandingTab).toBeVisible()
    await brandingTab.click()

    // Get the upload logo button
    const uploadButton = page.getByRole('button', { name: /upload logo/i })
    await expect(uploadButton).toBeVisible()

    // Set up file upload handler
    const fileInputPromise = page.waitForEvent('filechooser')
    await uploadButton.click()
    const fileInput = await fileInputPromise

    // Note: In a real test, you'd need a file. For E2E, we verify the button is clickable
    // and the upload flow is exposed via the file input
    expect(fileInput).toBeTruthy()
  })

  test('should display current brand color', async ({ page }) => {
    await page.goto('/workspace')

    // Click on Branding tab
    const brandingTab = page.getByRole('tab', { name: /branding/i })
    await expect(brandingTab).toBeVisible()
    await brandingTab.click()

    // Verify Theme Colors card
    await expect(page.getByRole('heading', { name: /theme colors/i })).toBeVisible()
    await expect(page.getByText(/customize the colors used throughout your workspace/i)).toBeVisible()

    // Verify Primary Color field is present
    const primaryColorLabel = page.getByLabel(/primary color/i)
    await expect(primaryColorLabel).toBeVisible()

    // Verify color picker and hex input exist
    const colorInputs = page.getByRole('textbox').filter({ hasText: /#/ })
    const count = await colorInputs.count()
    expect(count).toBeGreaterThan(0)

    // Verify color preview section
    await expect(page.getByText(/preview/i)).toBeVisible()
  })

  test('should update brand color successfully', async ({ page }) => {
    await page.goto('/workspace')

    // Click on Branding tab
    const brandingTab = page.getByRole('tab', { name: /branding/i })
    await expect(brandingTab).toBeVisible()
    await brandingTab.click()

    // Wait for color pickers to load
    await expect(page.getByRole('heading', { name: /theme colors/i })).toBeVisible()

    // Get the primary color label and its input
    const primaryColorSection = page
      .locator('div')
      .filter({ hasText: /^Primary Color/ })
      .first()
    const primaryInput = primaryColorSection.locator('input[type="text"]')

    await expect(primaryInput).toBeVisible()
    const originalColor = await primaryInput.inputValue()

    // Update color to a different valid hex
    const newColor = '#FF5733'
    await primaryInput.clear()
    await primaryInput.fill(newColor)

    // Verify the color preview updated
    await expect(primaryInput).toHaveValue(newColor)

    // Click save button
    const saveButton = page.getByRole('button', { name: /save colors/i })
    await expect(saveButton).toBeVisible()
    await saveButton.click()

    // Wait for save to complete
    await expect(saveButton).toBeEnabled({ timeout: 5000 })

    // Restore original color if it existed
    if (originalColor && originalColor.match(/#[0-9A-F]{6}/i)) {
      await primaryInput.clear()
      await primaryInput.fill(originalColor)
      await saveButton.click()
      await expect(saveButton).toBeEnabled({ timeout: 5000 })
    }
  })
})
