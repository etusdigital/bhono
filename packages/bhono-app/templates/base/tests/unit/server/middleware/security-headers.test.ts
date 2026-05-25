import { describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import { NONCE } from 'hono/secure-headers'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { securityHeaders } from '@server/middleware/security-headers'
import type { HonoEnv } from '@server/types'
import { createMockEnv } from '@tests/helpers/server'

function makeApp(environment: string) {
  const app = new Hono<HonoEnv>()
  const env = createMockEnv({ ENVIRONMENT: environment })
  app.use('*', securityHeaders(env))
  app.get('/ok', (c) => {
    const cspNonce = NONCE(c, 'script-src')
    const nonce = cspNonce.slice("'nonce-".length, -1)
    return c.html(`<script nonce="${nonce}">window.ok = true</script>`)
  })
  return { app, env }
}

describe('securityHeaders', () => {
  it('sets a strict CSP with nonce-backed scripts', async () => {
    const { app, env } = makeApp('production')
    const res = await app.request('/ok', {}, env)
    const csp = res.headers.get('Content-Security-Policy')

    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("script-src 'self' 'nonce-")
    expect(csp).toContain("style-src 'self'")
    // <style> elements and scripts stay strict. Inline style attributes are
    // explicitly allowed via style-src-attr so Radix primitives keep working —
    // verify the narrow opt-in didn't leak into the umbrella style-src.
    expect(csp).toContain("style-src-attr 'unsafe-inline'")
    expect(csp).not.toMatch(/style-src 'self'[^;]*'unsafe-inline'/)
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/)
    expect(await res.text()).toContain('script nonce="')
  })

  it('sets browser hardening headers', async () => {
    const { app, env } = makeApp('production')
    const res = await app.request('/ok', {}, env)

    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(res.headers.get('X-Frame-Options')).toBe('DENY')
    expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
    expect(res.headers.get('Permissions-Policy')).toContain('camera=()')
  })

  it('only sets HSTS for production to avoid breaking local HTTP development', async () => {
    const production = makeApp('production')
    const development = makeApp('development')

    const prodRes = await production.app.request('/ok', {}, production.env)
    const devRes = await development.app.request('/ok', {}, development.env)

    expect(prodRes.headers.get('Strict-Transport-Security')).toBe('max-age=31536000; includeSubDomains')
    expect(devRes.headers.get('Strict-Transport-Security')).toBeNull()
  })

  it('ships static asset security headers for Cloudflare assets', () => {
    const headers = readFileSync(join(process.cwd(), 'public/_headers'), 'utf8')

    expect(headers).toContain("Content-Security-Policy: default-src 'self'")
    expect(headers).toContain("script-src 'self'")
    expect(headers).toContain("frame-ancestors 'none'")
    expect(headers).toContain("style-src-attr 'unsafe-inline'")
    expect(headers).toContain("require-trusted-types-for 'script'")
    expect(headers).toContain('Strict-Transport-Security: max-age=31536000; includeSubDomains')
  })
})
