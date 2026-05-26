import { test as setup, expect } from '@playwright/test'
import * as fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const authFile = path.join(__dirname, '.auth/user.json')
const accountFile = path.join(__dirname, '.auth/account.json')

// Production URL pattern - skip test-login for these
const PRODUCTION_URLS = [
  'hono-boilerplate.a3s.workers.dev',
  'workers.dev',
]

function isProductionUrl(baseUrl: string): boolean {
  return PRODUCTION_URLS.some(pattern => baseUrl.includes(pattern))
}

setup('authenticate', async ({ page, context, baseURL }) => {
  // Check if we're running against production
  if (baseURL && isProductionUrl(baseURL)) {
    console.log(`Running against production: ${baseURL}`)

    // Check if pre-captured OAuth session exists
    if (fs.existsSync(authFile)) {
      const authState = JSON.parse(fs.readFileSync(authFile, 'utf-8'))

      // Verify session has cookies (not empty)
      if (authState.cookies?.length > 0) {
        console.log(`Using pre-captured OAuth session with ${authState.cookies.length} cookies`)

        // Add cookies to context
        await context.addCookies(authState.cookies)

        // Navigate to set cookies in browser context
        await page.goto('/')
        await page.waitForLoadState('domcontentloaded')

        // Verify auth works using context.request (shares cookies with browser)
        const meResponse = await context.request.get(`${baseURL}/auth/me`)
        const meStatus = meResponse.status()
        const meBodyText = await meResponse.text()
        console.log(`Auth verification: status=${meStatus}, body=${meBodyText.substring(0, 200)}`)

        if (meResponse.ok()) {
          const userData = JSON.parse(meBodyText)
          console.log(`Authenticated as: ${userData.user?.email || userData.email || 'unknown'}`)

          const accountsResponse = await context.request.get(`${baseURL}/accounts`)
          if (accountsResponse.ok()) {
            const accountsData = await accountsResponse.json()
            if (accountsData.accounts?.[0]?.id) {
              fs.writeFileSync(accountFile, JSON.stringify({ accountId: accountsData.accounts[0].id }, null, 2))
            }
          }

          // Verify dashboard access
          await page.goto('/dashboard')
          await expect(page).not.toHaveURL(/login/)

          // Re-save auth state (in case cookies were refreshed)
          await context.storageState({ path: authFile })
          return
        } else {
          console.log('Pre-captured session expired or invalid')
          console.log('Run: pnpm test:e2e:prod:auth to capture a new session')
        }
      }
    }

    // No valid pre-captured session for production
    console.log('No valid OAuth session found for production')
    console.log('Run: pnpm test:e2e:prod:auth to capture a session first')
    console.log('Tests requiring authentication will be skipped')
    // DO NOT overwrite auth file in production - preserve any existing captured session
    return
  }

  // Development/local: use test-login endpoint
  await page.goto('/')

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
