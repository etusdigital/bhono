import { test as setup, expect } from '@playwright/test'
import * as fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const authFile = path.join(__dirname, '.auth/viewer.json')
const accountFile = path.join(__dirname, '.auth/viewer-account.json')

/**
 * Setup: Authenticate as Viewer
 *
 * Uses seed data user: viewer@example.com (role: viewer)
 * This fixture is for testing permission restrictions:
 * - Read-only views
 * - Restricted actions
 * - Permission-based UI hiding
 */
setup('authenticate as viewer', async ({ page, context }) => {
  await page.goto('/')

  const response = await page.request.post('/auth/test-login', {
    data: {
      email: 'viewer@example.com',
      name: 'Viewer User',
    },
    failOnStatusCode: false,
  })

  if (!response.ok()) {
    const body = await response.text()
    console.log('Viewer login failed:', response.status(), body)
    throw new Error(`Viewer login failed: ${response.status()} - ${body}`)
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
  console.log(`Authenticated as viewer: ${userEmail}`)

  // Verify viewer has limited role in their account (accounts may be nested under user)
  const accounts = userData.user?.accounts ?? userData.accounts
  const account = accounts?.find((a: { role: string }) => a.role === 'viewer')
  if (!account) {
    console.warn('Warning: viewer@example.com does not have viewer role. Check seed data.')
  }

  // Navigate to dashboard to verify access
  await page.goto('/dashboard')
  await expect(page).not.toHaveURL(/login/)

  // Save authenticated state
  await context.storageState({ path: authFile })
})
