import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('env', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should use default values when optional vars not set', async () => {
    process.env.JWT_SECRET = 'test-secret-key-at-least-32-chars-long'
    process.env.GOOGLE_CLIENT_ID = 'test-google-client-id'
    process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret'
    process.env.SENDGRID_API_KEY = 'test-sendgrid-api-key'
    process.env.SENDGRID_FROM_EMAIL = 'test@example.com'
    delete process.env.NODE_ENV
    delete process.env.PORT
    delete process.env.DATABASE_URL
    const { env } = await import('./env')

    expect(env.PORT).toBe(3000)
    expect(env.NODE_ENV).toBe('development')
    expect(env.DATABASE_URL).toBe('db.sqlite')
  })

  it('should parse PORT as number', async () => {
    process.env.JWT_SECRET = 'test-secret-key-at-least-32-chars-long'
    process.env.GOOGLE_CLIENT_ID = 'test-google-client-id'
    process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret'
    process.env.SENDGRID_API_KEY = 'test-sendgrid-api-key'
    process.env.SENDGRID_FROM_EMAIL = 'test@example.com'
    process.env.PORT = '4000'
    const { env } = await import('./env')

    expect(env.PORT).toBe(4000)
  })
})
