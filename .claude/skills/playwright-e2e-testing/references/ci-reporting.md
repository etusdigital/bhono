# CI + Reporting (Playwright Test)

## Goals

1. Run tests in parallel (fast).
2. Keep failures debuggable (trace/video/screenshot artifacts).
3. Produce a **single** report even when tests are sharded across machines.

---

## Recommended pattern: shard + blob reporter + merge-reports

### Why blob reporter
Playwright’s blob reports are designed to merge results from sharded runs into one final report.

### Example commands

Run 4 shards (in parallel across 4 CI jobs):

```bash
npx playwright test --shard=1/4 --reporter=blob
npx playwright test --shard=2/4 --reporter=blob
npx playwright test --shard=3/4 --reporter=blob
npx playwright test --shard=4/4 --reporter=blob
```

Collect all blob report ZIPs into one directory (e.g. `all-blob-reports/`), then merge:

```bash
npx playwright merge-reports --reporter=html ./all-blob-reports
```

Result: a standard HTML report in `playwright-report/`.

Docs:
- Blob reporter: https://playwright.dev/docs/test-reporters#blob-reporter
- Sharding: https://playwright.dev/docs/test-sharding

---

## “Artifacts that matter” defaults

In `playwright.config.ts`:

1. `trace: 'on-first-retry'`
2. `video: 'retain-on-failure'` (or `on-first-retry`)
3. `screenshot: 'only-on-failure'`

The HTML report will link to these artifacts when present.

---

## JSON results for automation / analytics

Use JSON reporter when you want to feed results into custom scripts:

```bash
PLAYWRIGHT_JSON_OUTPUT_NAME=results.json npx playwright test --reporter=json
```

Docs:
- JSON reporter: https://playwright.dev/docs/test-reporters#json-reporter

---

## GitHub Actions template

See: `templates/ci/github-actions.playwright.yml`

This template:
1. Executes shards with blob reporter.
2. Uploads each blob report as an artifact.
3. Downloads and merges into a single HTML report.

---

## Common pitfalls

1. **Multiple HTML reports (one per shard)**  
   Fix: don’t generate HTML in each shard; generate blob and merge to HTML in a final job.

2. **CI logs are noisy**  
   Fix: use a concise reporter (e.g. `dot`) in addition to `blob`, or rely on `github` annotations.

3. **Flaky tests only on CI**  
   Fix: ensure CI uses the same browser + same env vars; capture trace on retry; reproduce locally with `--repeat-each` and throttling if needed.
