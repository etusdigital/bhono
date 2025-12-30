import { test as setup, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const authFile = path.join(__dirname, '.auth/user.json')

/**
 * Auth Setup
 *
 * This setup creates an authenticated state for E2E tests.
 * Since the app uses Google OAuth, we have two options:
 *
 * 1. Use a test account and real OAuth (slow, requires credentials)
 * 2. Mock the auth state by calling internal test endpoints (fast, recommended)
 *
 * For now, we'll create a mock session for E2E testing.
 * In production, you might use real OAuth or service account credentials.
 */

setup('authenticate', async ({ page, context }) => {
  // Navigate to the app
  await page.goto('/')

  // Check if already authenticated
  const response = await page.request.get('/auth/me')

  if (response.ok()) {
    // Already authenticated, save state
    await context.storageState({ path: authFile })
    return
  }

  // For E2E tests, we need to either:
  // Option 1: Use a test endpoint that creates a test session
  // Option 2: Mock the OAuth flow

  // Try to use test login endpoint (if available in dev/test environment)
  const testLoginResponse = await page.request.post('/auth/test-login', {
    data: {
      email: 'e2e-test@example.com',
      name: 'E2E Test User',
    },
    failOnStatusCode: false,
  })

  if (testLoginResponse.ok()) {
    // Test login successful, verify we're authenticated
    await page.goto('/dashboard')
    await expect(page.getByText(/welcome/i)).toBeVisible({ timeout: 10000 })

    // Save authenticated state
    await context.storageState({ path: authFile })
    return
  }

  // If no test endpoint, we need to set up auth differently
  // For now, create an empty auth file to allow unauthenticated tests to run
  console.log('Note: No test login endpoint available. Running tests without authentication.')
  console.log('To enable authenticated tests, add a /auth/test-login endpoint for E2E testing.')

  // Create empty auth state file (tests will run as unauthenticated)
  await context.storageState({ path: authFile })
})
