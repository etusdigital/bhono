import { test as base, expect, type Page } from '@playwright/test'

/**
 * Custom fixtures for boilerplate E2E tests
 */

type CustomFixtures = {
  /** Page that is already authenticated via storageState */
  authedPage: Page

  /** API helper for test data setup/teardown */
  api: {
    createUser: (data: { email: string; name: string }) => Promise<{ id: string }>
    deleteUser: (id: string) => Promise<void>
  }
}

export const test = base.extend<CustomFixtures>({
  authedPage: async ({ page }, use) => {
    // storageState is configured in the project, so page is already authenticated
    await use(page)
  },

  api: async ({ request }, use) => {
    const createdUserIds: string[] = []

    await use({
      createUser: async (data) => {
        const response = await request.post('/api/users', {
          data,
        })
        const user = await response.json()
        createdUserIds.push(user.id)
        return user
      },

      deleteUser: async (id) => {
        await request.delete(`/api/users/${id}`)
      },
    })

    // Cleanup: delete all created users after test
    for (const id of createdUserIds) {
      try {
        await request.delete(`/api/users/${id}`)
      } catch {
        // Ignore cleanup errors
      }
    }
  },
})

export { expect }

/**
 * Helper to wait for page navigation to complete
 */
export async function waitForNavigation(page: Page, path: string) {
  await page.waitForURL(`**${path}**`, { waitUntil: 'domcontentloaded' })
}

/**
 * Helper to check if user is authenticated
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  try {
    const response = await page.request.get('/auth/me')
    return response.ok()
  } catch {
    return false
  }
}

/**
 * Wait for a toast notification to appear
 */
export async function waitForToast(page: Page, text?: string | RegExp) {
  const toast = text
    ? page.getByRole('status').filter({ hasText: text })
    : page.getByRole('status')

  await expect(toast.first()).toBeVisible({ timeout: 5000 })
  return toast.first()
}

/**
 * Close all open dialogs by pressing Escape
 */
export async function closeAllDialogs(page: Page) {
  const dialogs = page.getByRole('dialog')
  const count = await dialogs.count()

  for (let i = 0; i < count; i++) {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
  }
}

/**
 * Check if element is within the visible viewport
 */
export async function isInViewport(page: Page, locator: ReturnType<Page['locator']>) {
  const box = await locator.boundingBox()
  if (!box) return false

  const viewport = page.viewportSize()
  if (!viewport) return false

  return (
    box.x >= 0 &&
    box.y >= 0 &&
    box.x + box.width <= viewport.width &&
    box.y + box.height <= viewport.height
  )
}

/**
 * Take a debug screenshot with timestamp
 */
export async function takeDebugScreenshot(page: Page, name: string) {
  await page.screenshot({
    path: `e2e/debug-screenshots/${name}-${Date.now()}.png`,
    fullPage: true,
  })
}
