import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getEnv, type Env } from './env'

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

describe('getEnv', () => {
  it('parses CORS_ORIGINS into array', () => {
    const mockEnv = {
      CORS_ORIGINS: 'https://app.example.com,https://admin.example.com',
      DB: {} as D1Database,
      ASSETS: {} as Fetcher,
      R2_BUCKET: {} as R2Bucket,
      R2_PUBLIC_URL: 'https://r2.example.com',
      ENVIRONMENT: 'test',
      APP_URL: 'https://app.example.com',
      JWT_SECRET: 'test-secret',
      JWT_EXPIRY_MINUTES: '15',
      GOOGLE_CLIENT_ID: 'test-client-id',
      GOOGLE_CLIENT_SECRET: 'test-client-secret',
      GOOGLE_REDIRECT_URI: 'https://app.example.com/auth/callback',
      REFRESH_TOKEN_EXPIRY_DAYS: '30',
      SENDGRID_API_KEY: 'test-api-key',
      SENDGRID_FROM_EMAIL: 'test@example.com',
    } as Env

    const result = getEnv(mockEnv)

    expect(result.CORS_ORIGINS_LIST).toEqual([
      'https://app.example.com',
      'https://admin.example.com',
    ])
  })

  it('trims whitespace from CORS_ORIGINS', () => {
    const mockEnv = {
      CORS_ORIGINS: 'https://app.example.com, https://admin.example.com',
      DB: {} as D1Database,
      ASSETS: {} as Fetcher,
      R2_BUCKET: {} as R2Bucket,
      R2_PUBLIC_URL: 'https://r2.example.com',
      ENVIRONMENT: 'test',
      APP_URL: 'https://app.example.com',
      JWT_SECRET: 'test-secret',
      JWT_EXPIRY_MINUTES: '15',
      GOOGLE_CLIENT_ID: 'test-client-id',
      GOOGLE_CLIENT_SECRET: 'test-client-secret',
      GOOGLE_REDIRECT_URI: 'https://app.example.com/auth/callback',
      REFRESH_TOKEN_EXPIRY_DAYS: '30',
      SENDGRID_API_KEY: 'test-api-key',
      SENDGRID_FROM_EMAIL: 'test@example.com',
    } as Env

    const result = getEnv(mockEnv)

    expect(result.CORS_ORIGINS_LIST).toEqual([
      'https://app.example.com',
      'https://admin.example.com',
    ])
  })

  it('returns empty array when CORS_ORIGINS not set', () => {
    const mockEnv = {
      DB: {} as D1Database,
      ASSETS: {} as Fetcher,
      R2_BUCKET: {} as R2Bucket,
      R2_PUBLIC_URL: 'https://r2.example.com',
      ENVIRONMENT: 'test',
      APP_URL: 'https://app.example.com',
      JWT_SECRET: 'test-secret',
      JWT_EXPIRY_MINUTES: '15',
      GOOGLE_CLIENT_ID: 'test-client-id',
      GOOGLE_CLIENT_SECRET: 'test-client-secret',
      GOOGLE_REDIRECT_URI: 'https://app.example.com/auth/callback',
      REFRESH_TOKEN_EXPIRY_DAYS: '30',
      SENDGRID_API_KEY: 'test-api-key',
      SENDGRID_FROM_EMAIL: 'test@example.com',
    } as Env

    const result = getEnv(mockEnv)

    expect(result.CORS_ORIGINS_LIST).toEqual([])
  })
})
