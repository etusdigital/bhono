import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { storage } from '@server/routes/storage'
import { errorHandler } from '@server/middleware/error-handler'
import type { HonoEnv } from '@server/types'
import { createMockR2AsR2Bucket } from '@tests/mocks/r2'

// Mounts the real storage router behind a stand-in that grants all
// permissions (so requirePermission guards pass) and the shared error
// handler (so thrown ValidationError/NotFoundError become HTTP responses).
function makeApp() {
  const app = new Hono<HonoEnv>()
  app.onError(errorHandler)
  app.use('*', async (c, next) => {
    c.set('authPermissions', ['*'])
    await next()
  })
  app.route('/storage', storage)
  return app
}

const envWith = (overrides: Record<string, unknown>) => ({
  R2_BUCKET: createMockR2AsR2Bucket(),
  R2_PUBLIC_URL: 'https://cdn.example.com',
  ...overrides,
})

describe('storage handlers', () => {
  it('POST /upload-url returns an upload target for a valid request', async () => {
    const res = await makeApp().request(
      '/storage/upload-url',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ filename: 'photo.png', contentType: 'image/png' }),
      },
      envWith({}),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { url: string; name: string; publicUrl: string }
    expect(body.name).toMatch(/photo\.png$/)
    expect(body.publicUrl).toContain('https://cdn.example.com/')
  })

  it('POST /upload-url fails when R2 is not configured', async () => {
    const res = await makeApp().request(
      '/storage/upload-url',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ filename: 'photo.png', contentType: 'image/png' }),
      },
      envWith({ R2_BUCKET: undefined }),
    )
    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  it('PUT /upload/:key stores the file and returns its public URL', async () => {
    const res = await makeApp().request(
      '/storage/upload/docs%2Ffile.txt',
      {
        method: 'PUT',
        headers: { 'content-type': 'text/plain' },
        body: 'hello world',
      },
      envWith({}),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { success: boolean; key: string }
    expect(body.success).toBe(true)
    expect(body.key).toBe('docs/file.txt')
  })

  it('PUT /upload/:key rejects an empty body', async () => {
    const res = await makeApp().request(
      '/storage/upload/empty.txt',
      { method: 'PUT', headers: { 'content-type': 'text/plain' }, body: '' },
      envWith({}),
    )
    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  it('DELETE /:key removes an existing file', async () => {
    const env = envWith({})
    // upload first so the file exists
    await makeApp().request(
      '/storage/upload/del.txt',
      { method: 'PUT', headers: { 'content-type': 'text/plain' }, body: 'x' },
      env,
    )
    const res = await makeApp().request('/storage/del.txt', { method: 'DELETE' }, env)
    expect(res.status).toBe(204)
  })

  it('DELETE /:key returns 404 for a missing file', async () => {
    const res = await makeApp().request(
      '/storage/missing.txt',
      { method: 'DELETE' },
      envWith({}),
    )
    expect(res.status).toBe(404)
  })
})
