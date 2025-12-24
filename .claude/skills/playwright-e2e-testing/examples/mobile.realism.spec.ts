import { test, expect } from '@playwright/test';
import { applyChromiumMobileProfile } from '../templates/helpers/chromium-mobile-profile';

test('mobile realism profile (Chromium) @mobile', async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium' && testInfo.project.name !== 'mobile-chrome', 'Chromium-only CDP profile');

  await applyChromiumMobileProfile(context, page, {
    disableCache: true,
    bypassServiceWorker: true,
    cpuThrottlingRate: 4,
    network: 'lighthouse-mobile',
  });

  await page.goto('/');
  await expect(page.getByRole('main')).toBeVisible();
});
