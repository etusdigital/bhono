import { test, expect } from '@playwright/test';

test('home is reachable @smoke', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('main')).toBeVisible();
});
