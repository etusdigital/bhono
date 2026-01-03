import type { Page } from '@playwright/test';

type GPTEventName = 'slotRenderEnded' | 'impressionViewable';

declare global {
  interface Window {
    __gptPerf?: {
      timeOrigin: number;
      events: Record<GPTEventName, Array<{ t: number; slotId?: string; adUnitPath?: string }>>;
    };
    googletag?: any;
  }
}

/**
 * Installs a lightweight GPT observer to measure:
 * - slotRenderEnded (first render)
 * - impressionViewable (first viewable)
 *
 * Works only if the page uses Google Publisher Tag (GPT).
 *
 * Notes:
 * - Ad blockers / privacy features may prevent GPT from loading.
 * - Some pages may not have GPT on the initial view.
 */
export async function installGPTObserver(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as any;

    w.__gptPerf = w.__gptPerf ?? {
      timeOrigin: performance.timeOrigin,
      events: { slotRenderEnded: [], impressionViewable: [] },
    };

    w.googletag = w.googletag || { cmd: [] };
    w.googletag.cmd.push(() => {
      try {
        const pubads = w.googletag.pubads();

        pubads.addEventListener('slotRenderEnded', (e: any) => {
          w.__gptPerf.events.slotRenderEnded.push({
            t: Math.round(performance.now()),
            slotId: e?.slot?.getSlotElementId?.(),
            adUnitPath: e?.slot?.getAdUnitPath?.(),
          });
        });

        pubads.addEventListener('impressionViewable', (e: any) => {
          w.__gptPerf.events.impressionViewable.push({
            t: Math.round(performance.now()),
            slotId: e?.slot?.getSlotElementId?.(),
            adUnitPath: e?.slot?.getAdUnitPath?.(),
          });
        });
      } catch {
        // No-op: GPT might not be available yet, or pubads() not initialized.
      }
    });
  });
}

export async function waitForFirstGPTEvent(page: Page, event: GPTEventName, timeoutMs = 15_000): Promise<{ t: number; slotId?: string; adUnitPath?: string }> {
  await page.waitForFunction(
    (ev: GPTEventName) => {
      const w = window as any;
      return Boolean(w.__gptPerf?.events?.[ev]?.length);
    },
    event,
    { timeout: timeoutMs }
  );

  return await page.evaluate((ev: GPTEventName) => {
    const w = window as any;
    return w.__gptPerf.events[ev][0];
  }, event);
}

export async function readGPTPerf(page: Page): Promise<unknown> {
  return await page.evaluate(() => (window as any).__gptPerf);
}
