# E2E Test Suite

This directory contains end-to-end tests for the boilerplate application using Playwright.

## Test Structure

```
e2e/
├── fixtures.ts           # Shared fixtures and helpers
├── auth.setup.ts         # Authentication setup (creates session)
├── smoke.unauth.spec.ts  # Smoke tests (unauthenticated)
├── auth-flows.unauth.spec.ts # Auth flow tests (unauthenticated)
├── auth.spec.ts          # Auth tests (authenticated)
├── crud/
│   ├── users.spec.ts     # User CRUD tests
│   ├── team.spec.ts      # Team management tests
│   └── integrations.spec.ts # Integrations page tests
├── journeys/
│   └── critical-flows.spec.ts # Critical user journeys
├── mobile/
│   └── responsive.spec.ts     # Mobile responsive tests
├── a11y/
│   └── accessibility.spec.ts  # Accessibility tests
├── api/
│   └── authenticated-api.spec.ts # API integration tests
├── errors/
│   └── error-handling.spec.ts # Error handling tests
└── visual/
    └── screenshots.spec.ts    # Visual regression tests
```

## Test Tags

Tests are tagged for selective execution:

| Tag | Description | Command |
|-----|-------------|---------|
| `@smoke` | Basic smoke tests | `npx playwright test --grep @smoke` |
| `@critical` | Critical path tests (run on all browsers) | `npx playwright test --grep @critical` |
| `@mobile` | Mobile responsive tests | `npx playwright test --project=mobile-chrome` |
| `@visual` | Visual regression tests | `npx playwright test --project=visual` |
| `@a11y` | Accessibility tests | `npx playwright test --project=a11y` |
| `@crud` | CRUD operation tests | `npx playwright test --grep @crud` |
| `@api` | API integration tests | `npx playwright test --grep @api` |
| `@error` | Error handling tests | `npx playwright test --grep @error` |

## Running Tests

### All tests
```bash
npm run test:e2e
```

### Specific project
```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=mobile-chrome
```

### With UI
```bash
npm run test:e2e:ui
```

### Debug mode
```bash
npm run test:e2e:debug
```

### Update visual snapshots
```bash
npx playwright test --project=visual --update-snapshots
```

## Authentication

Tests requiring authentication use `auth.setup.ts` which:
1. Calls `/auth/test-login` endpoint (development only)
2. Creates a test user session
3. Saves session state to `e2e/.auth/user.json`

The session is reused across authenticated tests.

## Writing New Tests

1. Choose the appropriate directory based on test type
2. Import from `fixtures.ts`:
   ```typescript
   import { test, expect, isAuthenticated } from '../fixtures'
   ```
3. Add appropriate tags in describe block:
   ```typescript
   test.describe('Feature @crud @critical', () => {
     // tests
   })
   ```
4. Use `test.beforeEach` for auth checks:
   ```typescript
   test.beforeEach(async ({ page }) => {
     const authenticated = await isAuthenticated(page)
     test.skip(!authenticated, 'Requires authentication')
   })
   ```

## Available Fixtures

- `authedPage` - Page with authenticated session
- `api` - API helpers for test data setup/teardown

## Helper Functions

- `waitForNavigation(page, path)` - Wait for navigation to complete
- `isAuthenticated(page)` - Check if user is authenticated
- `waitForToast(page, text?)` - Wait for toast notification
- `closeAllDialogs(page)` - Close all open dialogs
- `isInViewport(page, locator)` - Check if element is in viewport
- `takeDebugScreenshot(page, name)` - Take debug screenshot

## Coverage Goals

| Category | Target | Tests |
|----------|--------|-------|
| Smoke tests | 10+ | 9 |
| Auth flows | 20+ | 16+ |
| CRUD operations | 50+ | 60+ |
| Critical journeys | 15+ | 6 |
| Mobile tests | 10+ | 11 |
| Visual tests | 5+ | 7 |
| A11y tests | 10+ | 19 |
| API tests | 10+ | 15 |
| Error tests | 10+ | 19 |
| **Total** | **130+** | **~160** |

## CI Integration

Tests run automatically in CI with:
- Single worker to avoid resource issues
- Retries (2x) for flaky tests
- Blob reporter for sharded runs
- HTML report artifact upload
