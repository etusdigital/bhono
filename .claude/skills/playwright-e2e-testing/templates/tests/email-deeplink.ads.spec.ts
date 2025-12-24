import { test, expect } from '../fixtures';

/**
 * Example: email deep link -> page load -> first GPT ad slot renders + becomes viewable.
 *
 * Customize:
 * - URL path and query params
 * - What "success" means (e.g., content visible, correct offer, etc.)
 * - Timeouts (mobile networks can be slow)
 *
 * Tags:
 * - @critical: key revenue path
 * - @ads: ad assertions
 * - @mobile: tuned for mobile projects
 */
test('email deep link renders first ad slot @critical @ads @mobile', async ({ authedPage: page, ads }, testInfo) => {
  // This test is most reliable on Chromium because it can also use CDP realism helpers if needed.
  // Keep it runnable elsewhere by not hard-requiring CDP, but allow project-based tuning.
  const projectName = testInfo.project.name;

  await ads.install();

  // Optional: mid-tier mobile realism (Chromium-only). Uncomment if you import enableMobileRealism in fixtures.
  // if (projectName === 'mobile-chrome') {
  //   await enableMobileRealism(testInfo.workerInfo.workerIndex, page); // example only
  // }

  // Simulate the URL a user would open from an email click (include UTM/campaign params).
  await page.goto('/quiz/result?utm_source=email&utm_medium=click&utm_campaign=deep_link');

  // Assert primary content is visible first (avoid a test that only checks ads).
  await expect(page.getByRole('main')).toBeVisible();

  // Wait for first ad render.
  const render = await ads.waitForFirstRender(20_000);
  testInfo.attach('gpt-slot-render-ended', { body: JSON.stringify(render, null, 2), contentType: 'application/json' });

  // Wait for first viewable impression.
  const viewable = await ads.waitForFirstViewable(30_000);
  testInfo.attach('gpt-impression-viewable', { body: JSON.stringify(viewable, null, 2), contentType: 'application/json' });

  // Optional: screenshot for debugging (avoid strict visual assertions on dynamic ads).
  await page.screenshot({ path: testInfo.outputPath('after-load.png'), fullPage: false });
});
