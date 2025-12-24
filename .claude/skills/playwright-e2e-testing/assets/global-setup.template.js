import { chromium } from '@playwright/test';
import { LoginPage } from './tests-config/pages/LoginPage';

/**
 * Global Setup Script
 * 
 * This script runs once before all tests.
 * Use it for:
 * - Creating authentication state
 * - Seeding test data
 * - Starting services
 * - Database migrations
 */

async function globalSetup(config) {
  console.log('Running global setup...');

  // Setup authentication state
  await setupAuthentication(config);

  // Optional: Setup test data
  // await setupTestData();

  console.log('Global setup complete\n');
}

/**
 * Setup authentication and save state
 */
async function setupAuthentication(config) {
  console.log('🔐 Setting up authentication...');

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Use your login page object
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    // Login with test credentials
    const email = process.env.TEST_EMAIL || 'test@example.com';
    const password = process.env.TEST_PASSWORD || 'password123';

    await loginPage.login(email, password);

    // Verify login was successful
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    // Save authentication state
    await context.storageState({ path: 'auth.json' });

    console.log('Authentication state saved to auth.json');

  } catch (error) {
    console.error('Authentication setup failed:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

/**
 * Optional: Setup test data
 */
async function setupTestData() {
  console.log('📦 Setting up test data...');

  // Example: Seed database with test data
  try {
    // Call your API or database to create test data
    const response = await fetch('http://localhost:3000/api/seed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        users: 10,
        products: 50,
        orders: 100
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to seed data: ${response.statusText}`);
    }

    console.log('Test data seeded successfully');

  } catch (error) {
    console.error('Test data setup failed:', error.message);
    // Don't throw - continue with tests even if seeding fails
  }
}

export default globalSetup;
