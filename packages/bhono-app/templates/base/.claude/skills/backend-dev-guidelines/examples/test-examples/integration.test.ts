/**
 * Integration Test Example
 *
 * Example of API integration tests using testClient from Hono.
 * Shows test setup, authentication mocking, and assertions.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { testClient } from 'hono/testing'
import { Hono } from 'hono'
import type { HonoEnv } from '@server/types'

// ============================================================================
// Test Setup
// ============================================================================

/**
 * Create test app with mocked dependencies
 */
function createTestApp() {
  const app = new Hono<HonoEnv>()

  // Mock database binding
  const mockDb = createMockDb()

  // Setup middleware
  app.use('*', async (c, next) => {
    c.set('db', mockDb as unknown as D1Database)
    c.set('transactionId', 'test-tx-123')
    await next()
  })

  // Mount routes (import your actual routes)
  // app.route('/api', apiRouter)

  return { app, mockDb }
}

/**
 * Create mock D1 database
 */
function createMockDb() {
  const data: Record<string, unknown[]> = {
    products: [
      {
        id: 'product-1',
        account_id: 'account-123',
        name: 'Test Product',
        description: 'A test product',
        price: 9999,
        status: 'active',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
        created_by_id: 'user-123',
        updated_by_id: 'user-123',
        deleted_at: null,
      },
    ],
    users: [
      {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        is_super_admin: 0,
      },
    ],
  }

  return {
    prepare: (sql: string) => ({
      bind: (...params: unknown[]) => ({
        all: async () => {
          // Simple mock implementation
          if (sql.includes('SELECT') && sql.includes('products')) {
            return { results: data.products }
          }
          if (sql.includes('SELECT') && sql.includes('users')) {
            return { results: data.users }
          }
          return { results: [] }
        },
        first: async () => {
          if (sql.includes('SELECT') && sql.includes('products')) {
            return data.products[0]
          }
          return null
        },
        run: async () => ({ success: true }),
      }),
    }),
    batch: async (statements: unknown[]) => {
      return statements.map(() => ({ success: true }))
    },
  }
}

/**
 * Create authenticated request headers
 */
function authHeaders(accountId = 'account-123') {
  return {
    'account-id': accountId,
    'content-type': 'application/json',
  }
}

// ============================================================================
// Integration Tests
// ============================================================================

describe('Products API Integration', () => {
  let app: Hono<HonoEnv>
  let client: ReturnType<typeof testClient>

  beforeAll(() => {
    const testSetup = createTestApp()
    app = testSetup.app

    // Setup test routes for this example
    app.get('/api/products', async (c) => {
      return c.json({
        data: {
          items: [
            {
              id: 'product-1',
              name: 'Test Product',
              price: 9999,
              status: 'active',
            },
          ],
          pagination: {
            page: 1,
            limit: 20,
            totalItems: 1,
            totalPages: 1,
          },
        },
      })
    })

    app.get('/api/products/:id', async (c) => {
      const id = c.req.param('id')
      if (id === 'not-found') {
        return c.json(
          {
            error: {
              code: 'NOT_FOUND',
              message: 'Product not found',
              status: 404,
            },
          },
          404
        )
      }
      return c.json({
        data: {
          id: 'product-1',
          name: 'Test Product',
          price: 9999,
          status: 'active',
        },
      })
    })

    app.post('/api/products', async (c) => {
      const body = await c.req.json()
      return c.json(
        {
          data: {
            id: 'product-new',
            ...body,
            createdAt: '2024-01-01T00:00:00.000Z',
          },
        },
        201
      )
    })

    client = testClient(app)
  })

  describe('GET /api/products', () => {
    it('should return paginated products', async () => {
      const res = await app.request('/api/products', {
        headers: authHeaders(),
      })

      expect(res.status).toBe(200)

      const json = await res.json()
      expect(json.data.items).toHaveLength(1)
      expect(json.data.pagination.totalItems).toBe(1)
    })

    it('should require account-id header', async () => {
      const res = await app.request('/api/products')

      // In real app, this would return 400
      // For this example, we skip the middleware check
      expect(res.status).toBe(200)
    })
  })

  describe('GET /api/products/:id', () => {
    it('should return single product', async () => {
      const res = await app.request('/api/products/product-1', {
        headers: authHeaders(),
      })

      expect(res.status).toBe(200)

      const json = await res.json()
      expect(json.data.id).toBe('product-1')
      expect(json.data.name).toBe('Test Product')
    })

    it('should return 404 for non-existent product', async () => {
      const res = await app.request('/api/products/not-found', {
        headers: authHeaders(),
      })

      expect(res.status).toBe(404)

      const json = await res.json()
      expect(json.error.code).toBe('NOT_FOUND')
    })
  })

  describe('POST /api/products', () => {
    it('should create product', async () => {
      const res = await app.request('/api/products', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          name: 'New Product',
          description: 'A new product',
          price: 1999,
          status: 'draft',
        }),
      })

      expect(res.status).toBe(201)

      const json = await res.json()
      expect(json.data.name).toBe('New Product')
      expect(json.data.price).toBe(1999)
    })

    it('should validate required fields', async () => {
      const res = await app.request('/api/products', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          // Missing required fields
          description: 'No name provided',
        }),
      })

      // In real app with Zod validation, this would return 400
      // For this example, we accept anything
      expect(res.status).toBe(201)
    })
  })
})

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Helper to create authenticated session for tests
 */
async function createTestSession(app: Hono<HonoEnv>, userId: string) {
  // In real tests, this would call /auth/test-login endpoint
  return {
    cookie: `__Host-sid=test-session-${userId}`,
    userId,
  }
}

/**
 * Helper to seed test data
 */
async function seedTestData(mockDb: ReturnType<typeof createMockDb>) {
  // Add test data to mock database
  // In real tests, this would insert into actual D1 database
}

/**
 * Helper to clean up test data
 */
async function cleanupTestData(mockDb: ReturnType<typeof createMockDb>) {
  // Remove test data
  // In real tests, this would delete from D1 database
}
