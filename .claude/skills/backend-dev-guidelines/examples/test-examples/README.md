# Test Examples

Examples of unit and integration tests for the backend.

## Files

| File | Type |
|------|------|
| `service.test.ts` | Unit tests with mocking |
| `integration.test.ts` | API integration tests |

## Unit Testing Pattern

Unit tests isolate the service layer by mocking dependencies:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies
vi.mock('@server/db/sql', () => ({
  queryOne: vi.fn(),
  queryAll: vi.fn(),
  execute: vi.fn(),
}))

import { queryOne } from '@server/db/sql'

describe('myService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should do something', async () => {
    vi.mocked(queryOne).mockResolvedValueOnce({ id: '123' })

    const result = await myService.findById(mockDb, mockCtx, '123')

    expect(result.id).toBe('123')
    expect(queryOne).toHaveBeenCalledWith(
      mockDb,
      expect.stringContaining('SELECT'),
      ['123']
    )
  })
})
```

## Integration Testing Pattern

Integration tests use Hono's `testClient`:

```typescript
import { testClient } from 'hono/testing'
import app from '@server/index'

describe('API Integration', () => {
  it('should return products', async () => {
    const res = await app.request('/api/products', {
      headers: { 'account-id': 'test-account' },
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.items).toBeDefined()
  })
})
```

## Test Context Fixtures

Create reusable fixtures for ServiceContext:

```typescript
const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  isSuperAdmin: false,
}

const mockContext: ServiceContext = {
  accountId: 'account-123',
  user: mockUser,
  userRole: 'EDITOR',
  transactionId: 'tx-123',
}
```

## Running Tests

```bash
# Unit tests (watch mode)
pnpm test

# Unit tests (single run)
pnpm test:run

# Integration tests
pnpm test:integration

# Coverage report
pnpm test:coverage
```

## Coverage Thresholds

| Metric | Target |
|--------|--------|
| Statements | 90% |
| Branches | 84% |
| Functions | 85% |

## Best Practices

1. **Test behavior, not implementation** - Focus on what the function does, not how
2. **Use descriptive test names** - `it('should throw NotFoundError when product not found')`
3. **One assertion per test** - Keep tests focused
4. **Mock at boundaries** - Mock database, external APIs, not internal functions
5. **Use fixtures** - Reuse test data setup
6. **Clean up** - Reset mocks and state between tests
