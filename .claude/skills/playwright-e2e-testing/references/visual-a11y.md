# Visual + Accessibility Regression

## Visual snapshots (screenshots)

Use Playwright’s built-in screenshot assertions:

```ts
await expect(page).toHaveScreenshot('home.png');
```

Good practices:
1. Prefer **element screenshots** over full-page where possible (less noise).
2. Mask dynamic regions (ads, timestamps, rotating banners).
3. Stabilize layout: set viewport/device, disable animations, wait for fonts.

Docs:
- Screenshot assertions: https://playwright.dev/docs/test-snapshots

### Masking dynamic regions (example)

```ts
await expect(page).toHaveScreenshot('page.png', {
  mask: [
    page.locator('#ad-slot-top'),
    page.locator('.time-now'),
  ],
});
```

---

## ARIA snapshots (a11y snapshots)

ARIA snapshots validate the **accessible tree** instead of raw DOM:

```ts
await expect(page.getByRole('main')).toMatchAriaSnapshot(`
  - main
    - heading "Welcome"
`);
```

Docs:
- ARIA snapshots: https://playwright.dev/docs/aria-snapshots

Why it’s useful:
- Less brittle than DOM snapshots.
- Captures meaningful user-facing structure (roles, names).

---

## Updating snapshots

When UI changes are intentional:

```bash
npx playwright test --update-snapshots
```

---

## Where to use visual/a11y tests in an ad-heavy product

1. **Layout stability**: ensure ad containers reserve space (avoid CLS).
2. **Above-the-fold template sanity**: headline, CTA, key sections.
3. **Critical flows**: result pages that drive ad impressions and revenue.
