import { test, expect } from '@playwright/test';
import { installGPTObserver, waitForFirstGPTEvent } from '../templates/helpers/ad-gpt-observer';

test('email deep link triggers ad render @ads @critical', async ({ page }) => {
  await installGPTObserver(page);
  await page.goto('/quiz/result?utm_source=email&utm_medium=click');

  await expect(page.getByRole('main')).toBeVisible();

  const render = await waitForFirstGPTEvent(page, 'slotRenderEnded', 20_000);
  console.log('First slotRenderEnded:', render);
});
