import { test as setup, expect } from '@playwright/test'
import * as fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const authFile = path.join(__dirname, '.auth/super-admin.json')
const accountFile = path.join(__dirname, '.auth/super-admin-account.json')

/**
 * Setup: Authenticate as Super Admin
 *
 * Uses seed data user: superadmin@example.com (is_super_admin: true)
 * This fixture is for testing admin features like:
 * - Impersonation
 * - Account suspension/reactivation
 * - Global audit logs
 */
setup('authenticate as super admin', async ({ page, context }) => {
  await page.goto('/')

  const response = await page.request.post('/auth/test-login', {
    data: {
      email: 'superadmin@example.com',
      name: 'Super Admin',
    },
    failOnStatusCode: false,
  })

  if (!response.ok()) {
    const body = await response.text()
    console.log('Super admin login failed:', response.status(), body)
    throw new Error(`Super admin login failed: ${response.status()} - ${body}`)
  }

  const loginData = await response.json()

  // Save accountId (super admins may not have a default account)
  if (loginData.accountId) {
    fs.writeFileSync(accountFile, JSON.stringify({ accountId: loginData.accountId }, null, 2))
  }

  // Verify authentication and super admin status
  const meResponse = await page.request.get('/auth/me')
  const meStatus = meResponse.status()
  const meBody = await meResponse.text()
  console.log(`/auth/me response: status=${meStatus}, body=${meBody}`)

  if (!meResponse.ok()) {
    throw new Error(`/auth/me failed: ${meStatus} - ${meBody}`)
  }

  const userData = JSON.parse(meBody)
  const isSuperAdmin = userData.user?.isSuperAdmin ?? userData.isSuperAdmin
  const userEmail = userData.user?.email ?? userData.email

  if (!isSuperAdmin) {
    throw new Error(`User is not a super admin. Check seed data for superadmin@example.com`)
  }

  console.log(`Authenticated as super admin: ${userEmail}`)

  // Navigate to admin area to verify access
  await page.goto('/admin')
  await expect(page).not.toHaveURL(/login/)

  // Save authenticated state
  await context.storageState({ path: authFile })
})
