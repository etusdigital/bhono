import type { BrowserContext, Page } from '@playwright/test';

export type NetworkPreset =
  | 'none'
  | 'lighthouse-mobile' // ~150ms RTT, 1.6Mbps down, 0.75Mbps up
  | 'fast-3g'
  | 'slow-3g';

export type ChromiumMobileProfile = {
  disableCache?: boolean;
  bypassServiceWorker?: boolean;
  cpuThrottlingRate?: number; // 1 = none, 4 = 4x slower
  network?: NetworkPreset;
};

/**
 * Apply Chromium-only CDP throttling + cache controls.
 *
 * IMPORTANT:
 * - Works only on Chromium projects.
 * - This is a simulation. Always validate critical perf issues on real devices too.
 */
export async function applyChromiumMobileProfile(
  context: BrowserContext,
  page: Page,
  profile: ChromiumMobileProfile
): Promise<void> {
  const cdp = await context.newCDPSession(page);

  await cdp.send('Network.enable');

  if (profile.disableCache) {
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  }

  if (profile.bypassServiceWorker) {
    await cdp.send('Network.setBypassServiceWorker', { bypass: true });
  }

  if (profile.network && profile.network !== 'none') {
    const conditions = networkConditions(profile.network);
    await cdp.send('Network.emulateNetworkConditions', conditions);
  }

  if (typeof profile.cpuThrottlingRate === 'number') {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpuThrottlingRate });
  }
}

function mbpsToBytesPerSec(mbps: number): number {
  return Math.floor((mbps * 1024 * 1024) / 8);
}

function kbpsToBytesPerSec(kbps: number): number {
  return Math.floor((kbps * 1024) / 8);
}

function networkConditions(preset: NetworkPreset) {
  switch (preset) {
    case 'lighthouse-mobile':
      return {
        offline: false,
        latency: 150,
        downloadThroughput: mbpsToBytesPerSec(1.6),
        uploadThroughput: kbpsToBytesPerSec(750),
        connectionType: 'cellular4g',
      };
    case 'fast-3g':
      return {
        offline: false,
        latency: 150,
        downloadThroughput: mbpsToBytesPerSec(1.5),
        uploadThroughput: kbpsToBytesPerSec(750),
        connectionType: 'cellular3g',
      };
    case 'slow-3g':
      return {
        offline: false,
        latency: 400,
        downloadThroughput: kbpsToBytesPerSec(400),
        uploadThroughput: kbpsToBytesPerSec(400),
        connectionType: 'cellular3g',
      };
    default:
      return {
        offline: false,
        latency: 0,
        downloadThroughput: -1,
        uploadThroughput: -1,
        connectionType: 'wifi',
      };
  }
}
