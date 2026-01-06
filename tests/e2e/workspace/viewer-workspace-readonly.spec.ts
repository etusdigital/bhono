import { test, expect } from '../fixtures'

/**
 * Viewer Permission - Workspace Read-Only Tests
 *
 * Tests for viewer role restrictions on workspace settings page.
 * Viewers should see read-only views without edit/save capabilities.
 *
 * @tags @viewer @permissions @critical
 */

test.describe('Viewer Workspace Read-Only @viewer @critical', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to workspace page
    await page.goto('/workspace')

    // Verify page loads
    await expect(page.getByRole('heading', { name: /workspace settings/i })).toBeVisible()
  })

  test('should see workspace settings as read-only', async ({ page }) => {
    await page.goto('/workspace')

    // Verify page header is visible
    await expect(page.getByRole('heading', { name: /workspace settings/i })).toBeVisible()

    // Switch to general tab
    const generalTab = page.getByRole('tab', { name: /general/i })
    await expect(generalTab).toBeVisible()
    await generalTab.click()

    // Verify read-only content is shown
    // Instead of form inputs, viewers should see read-only display of workspace info
    const nameLabel = page.getByText(/workspace name/i).first()
    await expect(nameLabel).toBeVisible()

    // Verify inputs are NOT present (or are disabled)
    const nameInput = page.getByLabel(/workspace name/i)
    const inputExists = await nameInput.isVisible().catch(() => false)

    if (inputExists) {
      // If input exists, it should be disabled
      await expect(nameInput).toBeDisabled()
    } else {
      // Otherwise, we should see read-only text display
      const readOnlyText = page.locator('text=/contact an admin to make changes/i').first()
      await expect(readOnlyText).toBeVisible()
    }
  })

  test('should not see edit or save buttons', async ({ page }) => {
    await page.goto('/workspace')

    // Check general tab
    const generalTab = page.getByRole('tab', { name: /general/i })
    await expect(generalTab).toBeVisible()
    await generalTab.click()

    // Verify no save button is visible in general tab
    const saveButton = page.getByRole('button', { name: /save changes/i })
    const saveExists = await saveButton.isVisible().catch(() => false)
    expect(saveExists).toBe(false)

    // Check branding tab
    const brandingTab = page.getByRole('tab', { name: /branding/i })
    await expect(brandingTab).toBeVisible()
    await brandingTab.click()

    // Verify no upload or edit buttons in branding
    const uploadButton = page.getByRole('button', { name: /upload/i })
    const uploadExists = await uploadButton.isVisible().catch(() => false)
    expect(uploadExists).toBe(false)

    // Verify read-only message is displayed
    const readOnlyMessage = page.getByText(/contact an admin to make changes/i)
    await expect(readOnlyMessage).toBeVisible()
  })
})
