import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { configurableCors } from '@server/middleware/cors'

describe('configurableCors', () => {
  it('allows origin from CORS_ORIGINS list', async () => {
    const app = new Hono()
    app.use('*', configurableCors({
      corsOrigins: ['https://app.example.com', 'https://admin.example.com'],
      appUrl: 'https://default.example.com',
    }))
    app.get('/api/test', (c) => c.json({ ok: true }))

    const res = await app.request('/api/test', {
      headers: { Origin: 'https://app.example.com' },
    })

    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example.com')
  })

  it('rejects origin not in CORS_ORIGINS list', async () => {
    const app = new Hono()
    app.use('*', configurableCors({
      corsOrigins: ['https://app.example.com'],
      appUrl: 'https://default.example.com',
    }))
    app.get('/api/test', (c) => c.json({ ok: true }))

    const res = await app.request('/api/test', {
      headers: { Origin: 'https://malicious.com' },
    })

    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })

  it('uses APP_URL when CORS_ORIGINS is empty', async () => {
    const app = new Hono()
    app.use('*', configurableCors({
      corsOrigins: [],
      appUrl: 'https://default.example.com',
    }))
    app.get('/api/test', (c) => c.json({ ok: true }))

    const res = await app.request('/api/test', {
      headers: { Origin: 'https://default.example.com' },
    })

    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://default.example.com')
  })

  it('ignores wildcard origins because credentialed CORS requires an explicit origin', async () => {
    const app = new Hono()
    app.use('*', configurableCors({
      corsOrigins: ['*'],
      appUrl: 'https://default.example.com',
    }))
    app.get('/api/test', (c) => c.json({ ok: true }))

    const res = await app.request('/api/test', {
      headers: { Origin: 'https://malicious.com' },
    })

    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })

  it('sets credentials to true', async () => {
    const app = new Hono()
    app.use('*', configurableCors({
      corsOrigins: ['https://app.example.com'],
      appUrl: 'https://default.example.com',
    }))
    app.get('/api/test', (c) => c.json({ ok: true }))

    const res = await app.request('/api/test', {
      headers: { Origin: 'https://app.example.com' },
    })

    expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true')
  })

  it('allows required headers', async () => {
    const app = new Hono()
    app.use('*', configurableCors({
      corsOrigins: ['https://app.example.com'],
      appUrl: 'https://default.example.com',
    }))
    app.options('/api/test', (c) => c.text(''))

    const res = await app.request('/api/test', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://app.example.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type',
      },
    })

    const allowedHeaders = res.headers.get('Access-Control-Allow-Headers')
    expect(allowedHeaders).toContain('Content-Type')
    expect(allowedHeaders).toContain('X-CSRF-Token')
    expect(allowedHeaders).toContain('X-Requested-With')
    expect(allowedHeaders).toContain('X-Account-ID')
    expect(allowedHeaders).toContain('Account-ID')
    expect(allowedHeaders).not.toContain('Authorization')
  })
})
