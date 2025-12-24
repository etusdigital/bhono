import { test as base, expect, type Page, type BrowserContext } from '@playwright/test';
import { installGPTObserver, waitForFirstGPTEvent } from './helpers/ad-gpt-observer';
import { applyChromiumMobileProfile } from './helpers/chromium-mobile-profile';

type Fixtures = {
  authedPage: Page;
  ads: {
    install: () => Promise<void>;
    waitForFirstRender: (timeoutMs?: number) => Promise<unknown>;
    waitForFirstViewable: (timeoutMs?: number) => Promise<unknown>;
  };
};

export const test = base.extend<Fixtures>({
  authedPage: async ({ page }, use) => {
    // If storageState is configured in the project, this page is already authenticated.
    await use(page);
  },

  ads: async ({ page, context }, use) => {
    await use({
      install: async () => {
        await installGPTObserver(page);
      },
      waitForFirstRender: async (timeoutMs = 15_000) => waitForFirstGPTEvent(page, 'slotRenderEnded', timeoutMs),
      waitForFirstViewable: async (timeoutMs = 20_000) => waitForFirstGPTEvent(page, 'impressionViewable', timeoutMs),
    });
  },
});

export { expect };

/**
 * Optional: call this at the start of a test to simulate a more realistic mid-tier mobile profile.
 * NOTE: CDP throttling only works on Chromium projects.
 */
export async function enableMobileRealism(context: BrowserContext, page: Page) {
  await applyChromiumMobileProfile(context, page, {
    cpuThrottlingRate: 4,
    network: 'lighthouse-mobile',
    disableCache: true,
    bypassServiceWorker: true,
  });
}
