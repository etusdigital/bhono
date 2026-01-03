# Examples (How to Use the Skill)

This directory contains small, copy/paste-friendly examples that you can adapt to your repo.

## 1) Minimal “smoke” test

- Use web-first assertions.
- Use user-facing locators.
- Tag it as @smoke so CI can run it fast.

See: `smoke.home.spec.ts`

## 2) Ads instrumentation (GPT)

- Install a GPT observer before navigation.
- Wait for `slotRenderEnded` and optionally `impressionViewable`.

See: `ads.email-deeplink.spec.ts`

## 3) Mobile realism (Chromium only)

- Disable cache.
- Bypass service workers.
- Apply CPU + network throttling presets.

See: `mobile.realism.spec.ts`
