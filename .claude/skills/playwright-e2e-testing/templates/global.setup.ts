import { chromium, type FullConfig } from '@playwright/test';

/**
 * Global setup to create reusable auth storageState.
 *
 * Usage:
 * - Add `globalSetup: require.resolve('./tests/global.setup')` to playwright.config.ts
 * - Or prefer the `*.setup.ts` project approach (recommended for flexibility)
 *
 * Customize:
 * - baseURL
 * - selectors / login flow
 * - output path
 */

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL as string | undefined;
  const url = baseURL ?? 'http://localhost:3000';

  const browser = await chromium.launch();
  const page = await browser.newPage();

  // TODO: Implement your login flow here.
  // Example:
  // await page.goto(`${url}/login`);
  // await page.getByLabel('Email').fill(process.env.E2E_EMAIL ?? '');
  // await page.getByLabel('Password').fill(process.env.E2E_PASSWORD ?? '');
  // await page.getByRole('button', { name: 'Sign in' }).click();
  // await page.waitForURL('**/dashboard');

  // Save auth state for reuse.
  await page.context().storageState({ path: '.auth/user.json' });

  await browser.close();
}
