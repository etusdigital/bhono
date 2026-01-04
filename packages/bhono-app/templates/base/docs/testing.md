# Testing Guide

## Quick Start

```bash
# Run all tests
npm test              # Backend unit tests (watch mode)
npm run test:client   # Frontend tests (watch mode)
npm run test:e2e      # Playwright E2E tests

# Run with coverage
npm run test:coverage        # Backend with coverage
npm run test:coverage:client # Frontend with coverage

# CI mode (no watch)
npm run test:run
```

## Test Structure

```
tests/
├── unit/
│   ├── server/              # Backend unit tests (services/routes/middleware/lib)
│   ├── client/              # Frontend unit tests (components/routes/hooks)
│   └── shared/              # Shared schema/unit tests
├── integration/             # Integration tests (D1/KV/R2 + workflows)
├── e2e/                     # Playwright E2E tests
│   ├── journeys/            # User journey tests
│   ├── crud/                # CRUD operation tests
│   ├── api/                 # API tests
│   ├── a11y/                # Accessibility tests
│   ├── visual/              # Visual regression
│   └── mobile/              # Responsive tests
├── fixtures/                # Test fixtures
├── mocks/                   # Test mocks (D1/KV/R2)
└── helpers/                 # Test utilities
```

## Backend Tests (Vitest)

### Running Tests

```bash
npm test                        # Watch mode
npm run test:run                # Single run
npm run test:coverage           # With coverage report
vitest run tests/unit/server/services  # Specific folder
```

### Mock Services

Import mocks for Cloudflare services:

```typescript
import { createMockD1, setMockQueryResult } from '@tests/mocks/db'
import { createMockKV, type MockKVNamespace } from '@tests/mocks/kv'
import { createMockR2, type MockR2Bucket } from '@tests/mocks/r2'

describe('MyService', () => {
  let db: ReturnType<typeof createMockD1>

  beforeEach(() => {
    db = createMockD1()
    setMockQueryResult(db, [1], [
      { id: '1', name: 'Test User' }
    ])
  })
})
```

### Testing Routes

Use Hono's testClient for type-safe route testing:

```typescript
import { testClient } from 'hono/testing'
import { Hono } from 'hono'
import { users } from '@server/routes/index'
import { createMockEnv } from '@tests/helpers/server'

const app = new Hono()
app.use('*', async (c, next) => {
  ;(c as any).env = createMockEnv()
  await next()
})
app.route('/users', users)

const client = testClient(app)

it('should create user', async () => {
  const res = await client.users.$post({ json: { name: 'Test' } })
  expect(res.status).toBe(201)
})
```

## Frontend Tests (Vitest + RTL)

### Running Tests

```bash
npm run test:client            # Watch mode
npm run test:coverage:client   # With coverage
```

### Component Testing

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from './button'

it('should handle click', async () => {
  const onClick = vi.fn()
  render(<Button onClick={onClick}>Click me</Button>)

  await userEvent.click(screen.getByRole('button'))
  expect(onClick).toHaveBeenCalled()
})
```

### Route Testing

```typescript
import { renderRouteAsync } from '@tests/helpers/client-test-utils'

it('should render dashboard', async () => {
  await renderRouteAsync({ initialEntries: ['/dashboard'] })

  expect(screen.getByText('Dashboard')).toBeInTheDocument()
})
```

## E2E Tests (Playwright)

### Running Tests

```bash
npm run test:e2e             # All tests
npm run test:e2e:ui          # UI mode (interactive)
npm run test:e2e:headed      # Visible browser
npm run test:e2e:debug       # Debug mode

# Run specific project
npm run test:e2e -- --project=chromium-unauth
```

### Test Projects

- `chromium-unauth`: Unauthenticated flows
- `chromium`: Authenticated flows (requires setup)
- `firefox`: Cross-browser testing
- `mobile-chrome`: Mobile device emulation

### Writing E2E Tests

```typescript
import { test, expect } from '../fixtures'

test('user can navigate to dashboard', async ({ page, authenticatedPage }) => {
  await authenticatedPage.goto('/dashboard')
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
})
```

## CI/CD (GitHub Actions)

Tests run automatically on push/PR to main/master:

- **Unit Tests**: Backend + Frontend with coverage
- **E2E Tests**: Chromium unauthenticated flows
- **Type Check**: TypeScript compilation
- **Lint**: ESLint checks

Coverage reports upload to Codecov automatically.

## Coverage Thresholds

| Layer | Statements | Branches | Functions | Lines |
|-------|------------|----------|-----------|-------|
| Backend | 90% | 85% | 85% | 90% |
| Frontend | 85% | 70% | 60% | 85% |
| Shared | 95% | 95% | 95% | 95% |

View coverage reports:
- `coverage/server/index.html` - Backend coverage
- `coverage/client/index.html` - Frontend coverage

## Best Practices

1. **Test behavior, not implementation** - Focus on what the code does, not how
2. **Use realistic data** - Mock data should resemble production
3. **Isolate tests** - Each test should be independent
4. **Avoid flaky tests** - Use proper waits, not arbitrary timeouts
5. **Keep tests fast** - Slow tests discourage running them
