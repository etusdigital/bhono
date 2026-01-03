import { test as base, expect, type Page, type BrowserContext } from '@playwright/test'
import * as fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { v4 as uuidv4 } from 'uuid'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.join(__dirname, '..', '..')
const authFile = path.join(__dirname, '.auth/user.json')
const accountFile = path.join(__dirname, '.auth/account.json')
const coverageDir = path.join(projectRoot, '.test-output', 'coverage', 'e2e', '.nyc_output')

/**
 * Custom Playwright fixtures for authenticated testing
 *
 * KEY PRINCIPLE: If storageState is configured, tests ARE authenticated.
 * No need for runtime checks - trust the configuration.
 */

type CustomFixtures = {
  /**
   * Verified authenticated page.
   * Navigates to dashboard and verifies auth before returning.
   * Use when you need GUARANTEED auth state.
   */
  authedPage: Page

  /**
   * Account ID from auth setup (for API requests)
   */
  accountId: string | null

  /**
   * API helper with account-id header pre-configured
   */
  api: {
    get: (url: string) => Promise<Response>
    post: (url: string, data?: unknown) => Promise<Response>
    put: (url: string, data?: unknown) => Promise<Response>
    patch: (url: string, data?: unknown) => Promise<Response>
    delete: (url: string) => Promise<Response>
  }
}

/**
 * Collect coverage from the browser and save to .nyc_output
 */
async function collectCoverage(page: Page, testTitle: string): Promise<void> {
  // Only collect coverage if instrumentation is enabled
  const hasCoverage = await page.evaluate(() => '__coverage__' in window)
  if (!hasCoverage) return

  const coverage = await page.evaluate(() => (window as unknown as { __coverage__: unknown }).__coverage__)
  if (!coverage) return

  // Ensure coverage directory exists
  if (!fs.existsSync(coverageDir)) {
    fs.mkdirSync(coverageDir, { recursive: true })
  }

  // Save coverage with unique filename
  const sanitizedTitle = testTitle.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 50)
  const filename = `coverage-${sanitizedTitle}-${uuidv4()}.json`
  fs.writeFileSync(path.join(coverageDir, filename), JSON.stringify(coverage))
}

/**
 * Check if auth file exists and has valid cookies
 */
function hasValidAuthFile(): boolean {
  try {
    if (!fs.existsSync(authFile)) return false
    const data = JSON.parse(fs.readFileSync(authFile, 'utf-8'))
    return data.cookies && data.cookies.length > 0
  } catch {
    return false
  }
}

/**
 * Get account ID from auth setup
 */
function getAccountIdFromFile(): string | null {
  try {
    if (fs.existsSync(accountFile)) {
      const data = JSON.parse(fs.readFileSync(accountFile, 'utf-8'))
      return data.accountId || null
    }
  } catch {
    // Ignore errors
  }
  return null
}

export const test = base.extend<CustomFixtures>({
  /**
   * Override base page fixture to collect coverage after EVERY test
   */
  page: async ({ page }, use, testInfo) => {
    await use(page)

    // Collect coverage after every test completes
    await collectCoverage(page, testInfo.title)
  },

  /**
   * Verified authenticated page fixture.
   * - Navigates to a protected route
   * - Verifies we're NOT redirected to login
   * - Returns the page ready for testing
   * Note: Coverage is now collected by the page fixture automatically
   */
  authedPage: async ({ page }, use) => {
    // Navigate to dashboard to verify auth works
    await page.goto('/dashboard')

    // If redirected to login, auth failed
    const url = page.url()
    if (url.includes('/login')) {
      throw new Error(
        'Authentication failed: redirected to login. ' +
        'Make sure auth setup ran successfully and storageState is configured.'
      )
    }

    await use(page)
  },

  /**
   * Account ID fixture - read once, use in all tests
   */
  accountId: async ({}, use) => {
    await use(getAccountIdFromFile())
  },

  /**
   * API helper with automatic account-id header
   */
  api: async ({ request, accountId }, use) => {
    const headers = accountId ? { 'account-id': accountId } : {}

    await use({
      get: (url: string) => request.get(url, { headers }),
      post: (url: string, data?: unknown) => request.post(url, { data, headers }),
      put: (url: string, data?: unknown) => request.put(url, { data, headers }),
      patch: (url: string, data?: unknown) => request.patch(url, { data, headers }),
      delete: (url: string) => request.delete(url, { headers }),
    })
  },
})

export { expect }

// Re-export useful types
export type { Page, BrowserContext }

/**
 * Helper to wait for page navigation to complete
 */
export async function waitForNavigation(page: Page, path: string) {
  await page.waitForURL(`**${path}**`, { waitUntil: 'domcontentloaded' })
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
 * Uses web-first assertions instead of arbitrary waits
 */
export async function closeAllDialogs(page: Page) {
  const dialogs = page.getByRole('dialog')
  let count = await dialogs.count()

  while (count > 0) {
    await page.keyboard.press('Escape')
    // Wait for dialog to be hidden (web-first assertion)
    await expect(dialogs.first()).toBeHidden({ timeout: 2000 }).catch(() => {})
    count = await dialogs.count()
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

// ============================================================================
// DEPRECATED - keeping for backward compatibility during migration
// These will be removed after all tests are updated
// ============================================================================

/**
 * @deprecated Use `authedPage` fixture instead.
 * This function is kept for backward compatibility.
 *
 * NOTE: This function now just checks if auth file exists with cookies.
 * It does NOT make an API call (which was causing race conditions in parallel tests).
 * The storageState in playwright.config.ts handles the actual authentication.
 */
export async function isAuthenticated(_page: Page): Promise<boolean> {
  // Just check if auth file exists with valid cookies
  // The storageState configuration handles the actual authentication
  // No API call needed - this was causing race conditions in parallel tests
  return hasValidAuthFile()
}

/**
 * @deprecated Use `accountId` fixture instead
 */
export function getAccountId(): string | null {
  return getAccountIdFromFile()
}

/**
 * @deprecated Use `api` fixture instead
 */
export async function apiRequest(
  page: Page,
  method: 'get' | 'post' | 'put' | 'patch' | 'delete',
  url: string,
  options?: { data?: unknown; headers?: Record<string, string> }
) {
  const accountId = getAccountIdFromFile()
  const headers = {
    ...(accountId ? { 'account-id': accountId } : {}),
    ...options?.headers,
  }

  return page.request[method](url, {
    data: options?.data,
    headers,
  })
}
