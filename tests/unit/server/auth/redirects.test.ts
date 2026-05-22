import { describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import { errorHandler } from '@server/middleware/error-handler'
import { isSafeAuthReturnTo, requireSafeAuthRedirects } from '@server/auth/redirects'
import type { HonoEnv } from '@server/types'

function encodeState(returnTo: string): string {
  const json = JSON.stringify({ csrf: 'csrf-token', returnTo })
  const binary = String.fromCharCode(...new TextEncoder().encode(json))
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function makeApp() {
  const app = new Hono<HonoEnv>()
  app.onError(errorHandler)
  app.use('/auth/*', requireSafeAuthRedirects())
  app.get('/auth/login', (c) => c.json({ ok: true }))
  app.get('/auth/callback', (c) => c.json({ ok: true }))
  return app
}

describe('isSafeAuthReturnTo', () => {
  it('allows empty values and same-site paths', () => {
    expect(isSafeAuthReturnTo(null)).toBe(true)
    expect(isSafeAuthReturnTo(undefined)).toBe(true)
    expect(isSafeAuthReturnTo('/dashboard')).toBe(true)
    expect(isSafeAuthReturnTo('/invite/token-123?from=email')).toBe(true)
  })

  it('rejects absolute, protocol-relative, encoded, and malformed redirects', () => {
    expect(isSafeAuthReturnTo('https://evil.example')).toBe(false)
    expect(isSafeAuthReturnTo('//evil.example/path')).toBe(false)
    expect(isSafeAuthReturnTo('%2F%2Fevil.example')).toBe(false)
    expect(isSafeAuthReturnTo('/%5Cevil.example')).toBe(false)
    expect(isSafeAuthReturnTo('/\u0000dashboard')).toBe(false)
    expect(isSafeAuthReturnTo(`/${'x'.repeat(2049)}`)).toBe(false)
  })
})

describe('requireSafeAuthRedirects', () => {
  it('lets safe login returnTo values continue to @etus/auth', async () => {
    const res = await makeApp().request('/auth/login?returnTo=%2Fdashboard')
    expect(res.status).toBe(200)
  })

  it('rejects unsafe login returnTo values before @etus/auth stores OAuth state', async () => {
    const res = await makeApp().request('/auth/login?returnTo=https%3A%2F%2Fevil.example')
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({
      error: { message: 'Unsafe auth returnTo redirect' },
    })
  })

  it('rejects unsafe returnTo values already encoded in OAuth callback state', async () => {
    const state = encodeState('//evil.example')
    const res = await makeApp().request(`/auth/callback?state=${state}`)
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({
      error: { message: 'Unsafe auth callback redirect' },
    })
  })

  it('ignores invalid callback state so @etus/auth can handle state validation', async () => {
    const res = await makeApp().request('/auth/callback?state=not-valid-base64')
    expect(res.status).toBe(200)
  })
})
