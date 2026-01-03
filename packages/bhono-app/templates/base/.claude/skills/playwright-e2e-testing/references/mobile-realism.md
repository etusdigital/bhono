# Mobile Realism (What You Can and Cannot Simulate)

## What you can do well (Playwright + emulation)

1. **Viewport + UA + touch** via device descriptors:
   - `devices['Pixel 5']`
   - `devices['iPhone 13']`

2. **Service worker control**:
   - Block SW registrations (`serviceWorkers: 'block'`) when you need clean behavior.

3. **Cache control** (Chromium/CDP only):
   - Disable HTTP cache.
   - Bypass service workers for requests.

4. **Network + CPU throttling** (Chromium/CDP only):
   - Apply mid-tier mobile profiles to catch long tasks and rendering delays.

Docs:
- Emulation: https://playwright.dev/docs/emulation
- CDP session: https://playwright.dev/docs/api/class-browsercontext#browser-context-new-cdp-session

---

## What you cannot perfectly simulate

1. True device hardware constraints (GPU/CPU scheduling, thermal throttling)
2. OEM WebView quirks on Android
3. Safari iOS “real device” behavior differences (tracking prevention, rendering edge cases)

For high-stakes issues (ads revenue paths), validate on real devices or a device cloud.

---

## Recommended approach

1. **Local (fast loop)**:
   - mobile emulation projects + traces/videos.
2. **CI (consistent)**:
   - same emulation + stable env vars + artifacts.
3. **Release gates (highest fidelity)**:
   - a small smoke suite on real devices (device cloud or lab).

---

## Helper included in templates

See:
- `templates/helpers/chromium-mobile-profile.ts` (CDP throttling + cache disable)
- `templates/fixtures.ts` (how to wire it into tests)
