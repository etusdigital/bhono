import { test as setup, expect } from '@playwright/test'
import * as fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const authFile = path.join(__dirname, '.auth/guest.json')
const accountFile = path.join(__dirname, '.auth/guest-account.json')

/**
 * Setup: Authenticate as Guest
 *
 * Uses dev-login user: guest@example.com (role: guest)
 * This fixture is for testing permission restrictions:
 * - Read-only views
 * - Restricted actions
 * - Permission-based UI hiding
 */
setup('authenticate as guest', async ({ page, context }) => {
  await page.goto('/')

  const response = await page.request.post('/auth/test-login', {
    data: {
      email: 'guest@example.com',
      name: 'Guest User',
      role: 'guest',
    },
    failOnStatusCode: false,
  })

  if (!response.ok()) {
    const body = await response.text()
    console.log('Guest login failed:', response.status(), body)
    throw new Error(`Guest login failed: ${response.status()} - ${body}`)
  }

  const loginData = await response.json()

  // Save accountId
  if (loginData.accountId) {
    fs.writeFileSync(accountFile, JSON.stringify({ accountId: loginData.accountId }, null, 2))
  }

  // Verify authentication
  const meResponse = await page.request.get('/auth/me')
  expect(meResponse.ok()).toBeTruthy()

  const userData = await meResponse.json()
  const userEmail = userData.user?.email ?? userData.email
  console.log(`Authenticated as guest: ${userEmail}`)

  // Verify guest has limited role in their account if account context is returned.
  const accounts = userData.user?.accounts ?? userData.accounts
  const account = accounts?.find((a: { role: string }) => a.role === 'guest')
  if (accounts && !account) {
    console.warn('Warning: guest@example.com does not have guest role. Check dev-login setup.')
  }

  // Navigate to dashboard to verify access
  await page.goto('/dashboard')
  await expect(page).not.toHaveURL(/login/)

  // Save authenticated state
  await context.storageState({ path: authFile })
})
