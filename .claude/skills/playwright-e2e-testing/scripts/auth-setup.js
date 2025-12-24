#!/usr/bin/env node

/**
 * Authentication Setup Script
 * 
 * This script helps set up authentication state for Playwright tests.
 * It performs a login and saves the authentication state to a file
 * that can be reused across tests.
 * 
 * Usage:
 *   node auth-setup.js
 *   node auth-setup.js --email user@example.com --password pass123
 *   node auth-setup.js --config auth-config.json
 */

const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// Default configuration
const DEFAULT_CONFIG = {
  baseURL: process.env.BASE_URL || 'http://localhost:3000',
  loginPath: '/login',
  emailSelector: 'input[name="email"], input[type="email"]',
  passwordSelector: 'input[name="password"], input[type="password"]',
  submitSelector: 'button[type="submit"]',
  successURL: '/dashboard',
  outputPath: 'auth.json',
  headless: process.env.CI ? true : false
};

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const config = { ...DEFAULT_CONFIG };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--email' && i + 1 < args.length) {
      config.email = args[++i];
    } else if (arg === '--password' && i + 1 < args.length) {
      config.password = args[++i];
    } else if (arg === '--base-url' && i + 1 < args.length) {
      config.baseURL = args[++i];
    } else if (arg === '--output' && i + 1 < args.length) {
      config.outputPath = args[++i];
    } else if (arg === '--config' && i + 1 < args.length) {
      const configFile = args[++i];
      const fileConfig = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
      Object.assign(config, fileConfig);
    } else if (arg === '--help') {
      printHelp();
      process.exit(0);
    }
  }

  // Read from environment if not provided
  if (!config.email) {
    config.email = process.env.TEST_EMAIL || 'test@example.com';
  }
  if (!config.password) {
    config.password = process.env.TEST_PASSWORD || 'password123';
  }

  return config;
}

function printHelp() {
  console.log(`
Authentication Setup Script

Usage:
  node auth-setup.js [options]

Options:
  --email <email>        Email for authentication
  --password <password>  Password for authentication
  --base-url <url>       Base URL of the application
  --output <path>        Output path for auth state (default: auth.json)
  --config <path>        Path to JSON config file
  --help                 Show this help message

Environment Variables:
  BASE_URL              Base URL (default: http://localhost:3000)
  TEST_EMAIL            Test user email (default: test@example.com)
  TEST_PASSWORD         Test user password (default: password123)
  CI                    Run in headless mode if set

Example:
  node auth-setup.js --email user@test.com --password pass123
  node auth-setup.js --config auth-config.json
  
Example auth-config.json:
  {
    "baseURL": "https://staging.example.com",
    "email": "test@example.com",
    "password": "password123",
    "loginPath": "/auth/login",
    "successURL": "/app/dashboard"
  }
`);
}

async function setupAuth(config) {
  console.log('Starting authentication setup...');
  console.log(`📍 Base URL: ${config.baseURL}`);
  console.log(`📧 Email: ${config.email}`);
  console.log(`💾 Output: ${config.outputPath}`);

  const browser = await chromium.launch({ 
    headless: config.headless,
    slowMo: config.headless ? 0 : 100 
  });
  
  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Navigate to login page
    console.log(`\n🌐 Navigating to ${config.baseURL}${config.loginPath}...`);
    await page.goto(`${config.baseURL}${config.loginPath}`);
    await page.waitForLoadState('domcontentloaded');

    // Fill in credentials
    console.log('✍️  Filling in credentials...');
    
    // Try to find email input
    let emailInput = page.locator(config.emailSelector).first();
    if (await emailInput.count() === 0) {
      // Fallback to label-based selector
      emailInput = page.getByLabel(/email/i).first();
    }
    await emailInput.fill(config.email);

    // Try to find password input
    let passwordInput = page.locator(config.passwordSelector).first();
    if (await passwordInput.count() === 0) {
      // Fallback to label-based selector
      passwordInput = page.getByLabel(/password/i).first();
    }
    await passwordInput.fill(config.password);

    // Submit form
    console.log('🔐 Submitting login form...');
    const submitButton = page.locator(config.submitSelector).first();
    await submitButton.click();

    // Wait for navigation
    console.log('⏳ Waiting for authentication...');
    await page.waitForURL(`**${config.successURL}`, { timeout: 10000 });

    // Save authentication state
    console.log('💾 Saving authentication state...');
    await context.storageState({ path: config.outputPath });

    const fullPath = path.resolve(config.outputPath);
    console.log(`\nAuthentication state saved to: ${fullPath}`);
    console.log('\n📝 Usage in tests:');
    console.log(`\n  test.use({ storageState: '${config.outputPath}' });\n`);

    // Verify the saved state
    const savedState = JSON.parse(fs.readFileSync(config.outputPath, 'utf-8'));
    console.log('📊 State summary:');
    console.log(`  - Cookies: ${savedState.cookies.length}`);
    console.log(`  - Origins: ${savedState.origins.length}`);

  } catch (error) {
    console.error('\nAuthentication setup failed:');
    console.error(error.message);
    
    // Take screenshot for debugging
    if (!config.headless) {
      try {
        const page = browser.contexts()[0]?.pages()[0];
        if (page) {
          await page.screenshot({ path: 'auth-setup-error.png' });
          console.error('📸 Screenshot saved to: auth-setup-error.png');
        }
      } catch (screenshotError) {
        // Ignore screenshot errors
      }
    }
    
    process.exit(1);
  } finally {
    await browser.close();
  }
}

// Main execution
async function main() {
  try {
    const config = parseArgs();
    await setupAuth(config);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
