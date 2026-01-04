// src/server/middleware/request-context.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { requestContext } from '@server/middleware/request-context'

// Mock uuidv7
vi.mock('uuidv7', () => ({
  uuidv7: vi.fn(),
}))

import { uuidv7 } from 'uuidv7'

describe('requestContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default mock for uuidv7
    vi.mocked(uuidv7).mockReturnValue('01912345-6789-7abc-def0-123456789012')
  })

  const createApp = () => {
    const app = new Hono()
    app.use('*', requestContext)
    app.get('/test', (c) => {
      return c.json({
        transactionId: c.get('transactionId'),
        ip: c.get('ip'),
        userAgent: c.get('userAgent'),
        user: c.get('user'),
        accountId: c.get('accountId'),
        userRole: c.get('userRole'),
        isSystemAdminAccess: c.get('isSystemAdminAccess'),
      })
    })
    return app
  }

  it('sets transactionId as valid UUID', async () => {
    const mockUuid = '01912345-6789-7abc-def0-123456789012'
    vi.mocked(uuidv7).mockReturnValue(mockUuid)

    const app = createApp()
    const res = await app.request('/test')
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.transactionId).toBe(mockUuid)
    expect(uuidv7).toHaveBeenCalled()
  })

  it('extracts IP from x-forwarded-for header', async () => {
    const app = createApp()
    const res = await app.request('/test', {
      headers: { 'x-forwarded-for': '192.168.1.100' },
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ip).toBe('192.168.1.100')
  })

  it('falls back to x-real-ip header', async () => {
    const app = createApp()
    const res = await app.request('/test', {
      headers: { 'x-real-ip': '10.0.0.50' },
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ip).toBe('10.0.0.50')
  })

  it('falls back to unknown when no IP header', async () => {
    const app = createApp()
    const res = await app.request('/test')
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ip).toBe('unknown')
  })

  it('prefers x-forwarded-for over x-real-ip', async () => {
    const app = createApp()
    const res = await app.request('/test', {
      headers: {
        'x-forwarded-for': '192.168.1.100',
        'x-real-ip': '10.0.0.50',
      },
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ip).toBe('192.168.1.100')
  })

  it('sets userAgent from header', async () => {
    const app = createApp()
    const res = await app.request('/test', {
      headers: { 'user-agent': 'Mozilla/5.0 TestBrowser' },
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.userAgent).toBe('Mozilla/5.0 TestBrowser')
  })

  it('sets userAgent to unknown when header missing', async () => {
    const app = createApp()
    const res = await app.request('/test')
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.userAgent).toBe('unknown')
  })

  it('initializes user to null', async () => {
    const app = createApp()
    const res = await app.request('/test')
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.user).toBe(null)
  })

  it('initializes accountId to empty string', async () => {
    const app = createApp()
    const res = await app.request('/test')
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.accountId).toBe('')
  })

  it('initializes userRole to null', async () => {
    const app = createApp()
    const res = await app.request('/test')
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.userRole).toBe(null)
  })

  it('initializes isSystemAdminAccess to false', async () => {
    const app = createApp()
    const res = await app.request('/test')
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.isSystemAdminAccess).toBe(false)
  })

  it('sets all context values in one request', async () => {
    const mockUuid = '01912345-6789-7abc-def0-123456789012'
    vi.mocked(uuidv7).mockReturnValue(mockUuid)

    const app = createApp()
    const res = await app.request('/test', {
      headers: {
        'x-forwarded-for': '192.168.1.100',
        'user-agent': 'CustomAgent/1.0',
      },
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({
      transactionId: mockUuid,
      ip: '192.168.1.100',
      userAgent: 'CustomAgent/1.0',
      user: null,
      accountId: '',
      userRole: null,
      isSystemAdminAccess: false,
    })
  })
})
