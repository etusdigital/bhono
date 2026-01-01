import { test as setup, expect } from '@playwright/test'
import * as fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const authFile = path.join(__dirname, '.auth/user.json')
const accountFile = path.join(__dirname, '.auth/account.json')

setup('authenticate', async ({ page, context }) => {
  // Navigate to the app first to establish context
  await page.goto('/')

  // Use test login endpoint
  const response = await page.request.post('/auth/test-login', {
    data: {
      email: 'e2e-test@example.com',
      name: 'E2E Test User',
    },
    failOnStatusCode: false,
  })

  if (!response.ok()) {
    const body = await response.text()
    console.log('Test login failed:', response.status(), body)

    // If test-login not available, create empty auth state
    console.log('Creating empty auth state - tests will run as unauthenticated')
    await context.storageState({ path: authFile })
    return
  }

  // Parse the response to get the accountId
  const loginData = await response.json()
  const accountId = loginData.accountId

  // Save accountId to file for API tests
  if (accountId) {
    fs.writeFileSync(accountFile, JSON.stringify({ accountId }, null, 2))
  }

  // Verify authentication works
  const meResponse = await page.request.get('/auth/me')
  expect(meResponse.ok()).toBeTruthy()

  // Navigate to dashboard to verify auth works in UI
  await page.goto('/dashboard')
  await expect(page).not.toHaveURL(/login/)

  // Save authenticated state
  await context.storageState({ path: authFile })
})
