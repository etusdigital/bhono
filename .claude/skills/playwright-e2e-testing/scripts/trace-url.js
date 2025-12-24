#!/usr/bin/env node

/**
 * trace-url.js
 *
 * Capture a Playwright trace for a URL using Chromium with optional mobile emulation and throttling.
 *
 * Why:
 * - Produces a trace.zip you can open with: `npx playwright show-trace trace.zip`
 * - Useful for debugging flakiness and performance regressions in a controlled way.
 *
 * Usage:
 *   node scripts/trace-url.js --url https://example.com/path
 *   node scripts/trace-url.js --url https://example.com --device "Pixel 5" --out ./artifacts
 *   node scripts/trace-url.js --url https://example.com --throttle lighthouse-mobile --cpu 4
 */

const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('@playwright/test');

function printHelp() {
  console.log(`
Playwright Trace Recorder

Required:
  --url <url>

Optional:
  --device <deviceName>           Playwright device descriptor, e.g. "Pixel 5", "iPhone 13"
  --out <dir>                     Output directory (default: ./artifacts)
  --wait <ms>                     Extra wait after navigation (default: 0)
  --throttle <preset>             Network preset: none | lighthouse-mobile | fast-3g | slow-3g (Chromium only)
  --cpu <rate>                    CPU throttling rate (1 = none, 4 = 4x slower) (Chromium only)
  --disable-cache                 Disable HTTP cache (Chromium only)
  --bypass-sw                     Bypass service worker (Chromium only)

Examples:
  node scripts/trace-url.js --url https://example.com --device "Pixel 5" --disable-cache --bypass-sw --throttle lighthouse-mobile --cpu 4
`);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { url: null, device: null, outDir: './artifacts', wait: 0, throttle: 'none', cpu: null, disableCache: false, bypassSW: false };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--url' && args[i + 1]) out.url = args[++i];
    else if (a === '--device' && args[i + 1]) out.device = args[++i];
    else if (a === '--out' && args[i + 1]) out.outDir = args[++i];
    else if (a === '--wait' && args[i + 1]) out.wait = parseInt(args[++i], 10);
    else if (a === '--throttle' && args[i + 1]) out.throttle = args[++i];
    else if (a === '--cpu' && args[i + 1]) out.cpu = parseFloat(args[++i]);
    else if (a === '--disable-cache') out.disableCache = true;
    else if (a === '--bypass-sw') out.bypassSW = true;
    else if (a === '--help') { printHelp(); process.exit(0); }
  }

  if (!out.url) {
    printHelp();
    process.exit(1);
  }

  return out;
}

function mbpsToBytesPerSec(mbps) {
  return Math.floor((mbps * 1024 * 1024) / 8);
}
function kbpsToBytesPerSec(kbps) {
  return Math.floor((kbps * 1024) / 8);
}

function networkConditions(preset) {
  switch (preset) {
    case 'lighthouse-mobile':
      return { offline: false, latency: 150, downloadThroughput: mbpsToBytesPerSec(1.6), uploadThroughput: kbpsToBytesPerSec(750), connectionType: 'cellular4g' };
    case 'fast-3g':
      return { offline: false, latency: 150, downloadThroughput: mbpsToBytesPerSec(1.5), uploadThroughput: kbpsToBytesPerSec(750), connectionType: 'cellular3g' };
    case 'slow-3g':
      return { offline: false, latency: 400, downloadThroughput: kbpsToBytesPerSec(400), uploadThroughput: kbpsToBytesPerSec(400), connectionType: 'cellular3g' };
    default:
      return null;
  }
}

async function main() {
  const cfg = parseArgs();
  fs.mkdirSync(cfg.outDir, { recursive: true });

  const device = cfg.device ? devices[cfg.device] : null;

  const browser = await chromium.launch();
  const context = await browser.newContext({
    ...(device || {}),
  });

  const page = await context.newPage();

  // Optional: Chromium-only CDP controls
  if (cfg.disableCache || cfg.bypassSW || cfg.throttle !== 'none' || cfg.cpu) {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');

    if (cfg.disableCache) await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    if (cfg.bypassSW) await cdp.send('Network.setBypassServiceWorker', { bypass: true });

    const net = networkConditions(cfg.throttle);
    if (net) await cdp.send('Network.emulateNetworkConditions', net);
    if (cfg.cpu) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cfg.cpu });
  }

  const tracePath = path.join(cfg.outDir, 'trace.zip');
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });

  await page.goto(cfg.url, { waitUntil: 'load' });

  if (cfg.wait > 0) await page.waitForTimeout(cfg.wait);

  await context.tracing.stop({ path: tracePath });

  await browser.close();

  console.log(`Trace written to: ${tracePath}`);
  console.log(`Open with: npx playwright show-trace ${tracePath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
