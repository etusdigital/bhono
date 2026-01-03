#!/usr/bin/env npx tsx

/**
 * Authentication Setup Script for OAuth
 *
 * This script helps set up authentication state for Playwright tests
 * when using OAuth providers (Google, GitHub, etc.).
 *
 * It opens a browser, you complete the OAuth flow manually,
 * and the script saves the authentication state to a file.
 *
 * Usage:
 *   pnpm tsx scripts/capture-prod-session.ts
 *   pnpm tsx scripts/capture-prod-session.ts --base-url https://staging.example.com
 *   pnpm tsx scripts/capture-prod-session.ts --output custom-auth.json
 *
 * Environment Variables:
 *   BASE_URL    Base URL of the application (default: production URL)
 *   CI          If set, runs in headless mode (not recommended for OAuth)
 */

import { chromium, devices } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

// Use same device as playwright setup to match user-agent fingerprint
const deviceConfig = devices['Desktop Chrome']

// Default configuration
const DEFAULT_CONFIG = {
  baseURL: process.env.BASE_URL || 'https://{{projectName}}.a3s.workers.dev',
  loginPath: '/login',
  successURLPattern: '**/dashboard',
  outputPath: 'tests/e2e/.auth/user.json',
  accountOutputPath: 'tests/e2e/.auth/account.json',
  headless: false, // OAuth requires headed mode
  timeout: 120_000, // 2 minutes for OAuth flow
  slowMo: 100
}

interface Config {
  baseURL: string
  loginPath: string
  successURLPattern: string
  outputPath: string
  accountOutputPath: string
  headless: boolean
  timeout: number
  slowMo: number
}

// Parse command line arguments
function parseArgs(): Config {
  const args = process.argv.slice(2)
  const config: Config = { ...DEFAULT_CONFIG }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (arg === '--base-url' && i + 1 < args.length) {
      config.baseURL = args[++i]
    } else if (arg === '--output' && i + 1 < args.length) {
      config.outputPath = args[++i]
    } else if (arg === '--timeout' && i + 1 < args.length) {
      config.timeout = parseInt(args[++i], 10)
    } else if (arg === '--headless') {
      config.headless = true
    } else if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    }
  }

  return config
}

function printHelp(): void {
  console.log(`
OAuth Authentication Setup Script

Usage:
  pnpm tsx scripts/capture-prod-session.ts [options]

Options:
  --base-url <url>    Base URL of the application
  --output <path>     Output path for auth state (default: tests/e2e/.auth/user.json)
  --timeout <ms>      Timeout for OAuth flow in ms (default: 120000)
  --headless          Run in headless mode (not recommended for OAuth)
  --help, -h          Show this help message

Environment Variables:
  BASE_URL            Base URL (default: https://{{projectName}}.a3s.workers.dev)

Examples:
  # Capture session from production
  pnpm tsx scripts/capture-prod-session.ts

  # Capture session from staging
  pnpm tsx scripts/capture-prod-session.ts --base-url https://staging.example.com

  # Custom output path
  pnpm tsx scripts/capture-prod-session.ts --output ./my-auth.json
`)
}

async function captureSession(config: Config): Promise<void> {
  console.log('\n🔐 OAuth Authentication Setup\n')
  console.log('━'.repeat(50))
  console.log(`📍 Base URL:  ${config.baseURL}`)
  console.log(`💾 Output:    ${config.outputPath}`)
  console.log(`⏱️  Timeout:   ${config.timeout / 1000}s`)
  console.log('━'.repeat(50))

  // Ensure output directory exists
  const outputDir = path.dirname(config.outputPath)
  fs.mkdirSync(outputDir, { recursive: true })

  const browser = await chromium.launch({
    headless: config.headless,
    slowMo: config.slowMo
  })

  try {
    // Use same device settings as playwright setup for user-agent consistency
    const context = await browser.newContext({
      ...deviceConfig,
    })
    const page = await context.newPage()

    // Navigate to login page
    console.log(`\n🌐 Navigating to ${config.baseURL}${config.loginPath}...`)
    await page.goto(`${config.baseURL}${config.loginPath}`)
    await page.waitForLoadState('domcontentloaded')

    console.log('\n' + '═'.repeat(50))
    console.log('👆 Please complete the OAuth login in the browser')
    console.log('   (Sign in with Google, GitHub, etc.)')
    console.log('═'.repeat(50) + '\n')

    console.log('⏳ Waiting for successful authentication...')

    // Wait for navigation to success URL (dashboard)
    try {
      await page.waitForURL(config.successURLPattern, {
        timeout: config.timeout
      })
      console.log('\n✅ Authentication successful!')
    } catch (error) {
      const currentUrl = page.url()
      console.log(`\n⚠️  Timeout waiting for ${config.successURLPattern}`)
      console.log(`   Current URL: ${currentUrl}`)

      // Check if we're on an authenticated page anyway
      if (
        currentUrl.includes('/dashboard') ||
        currentUrl.includes('/team') ||
        currentUrl.includes('/settings') ||
        currentUrl.includes('/account')
      ) {
        console.log('   → Detected authenticated page, continuing...')
      } else {
        throw new Error(
          `Authentication flow not completed. Current URL: ${currentUrl}`
        )
      }
    }

    // Verify authentication via API
    console.log('\n🔍 Verifying authentication...')
    const meResponse = await page.request.get(`${config.baseURL}/auth/me`)

    if (!meResponse.ok()) {
      throw new Error(
        `Auth verification failed. /auth/me returned ${meResponse.status()}`
      )
    }

    const userData = await meResponse.json()
    console.log(`   👤 Logged in as: ${userData.email}`)
    console.log(`   📛 Name: ${userData.name || 'N/A'}`)

    // Save account ID if available
    if (userData.accounts?.[0]?.id) {
      const accountData = { accountId: userData.accounts[0].id }
      fs.writeFileSync(
        config.accountOutputPath,
        JSON.stringify(accountData, null, 2)
      )
      console.log(`   🏢 Account ID saved to: ${config.accountOutputPath}`)
    }

    // Save authentication state
    console.log('\n💾 Saving authentication state...')
    await context.storageState({ path: config.outputPath })

    // Verify saved state
    const savedState = JSON.parse(fs.readFileSync(config.outputPath, 'utf-8'))
    console.log('\n📊 State summary:')
    console.log(`   - Cookies: ${savedState.cookies.length}`)
    console.log(`   - Origins: ${savedState.origins.length}`)

    const fullPath = path.resolve(config.outputPath)
    console.log(`\n✅ Authentication state saved to:\n   ${fullPath}`)

    console.log('\n' + '═'.repeat(50))
    console.log('📝 Usage in tests:')
    console.log('═'.repeat(50))
    console.log(`
  // In playwright.config.ts
  use: {
    storageState: '${config.outputPath}',
  }

  // Or run tests against production:
  BASE_URL=${config.baseURL} pnpm test:e2e
`)
  } catch (error) {
    console.error('\n❌ Authentication setup failed:')
    console.error(`   ${(error as Error).message}`)

    // Take screenshot for debugging
    try {
      const pages = browser.contexts()[0]?.pages()
      if (pages?.[0]) {
        const screenshotPath = 'auth-setup-error.png'
        await pages[0].screenshot({ path: screenshotPath, fullPage: true })
        console.error(`\n📸 Screenshot saved to: ${screenshotPath}`)
      }
    } catch {
      // Ignore screenshot errors
    }

    process.exit(1)
  } finally {
    await browser.close()
  }
}

// Main execution
async function main(): Promise<void> {
  try {
    const config = parseArgs()
    await captureSession(config)
  } catch (error) {
    console.error('Error:', (error as Error).message)
    process.exit(1)
  }
}

main()
