import { describe, it, expect } from 'vitest'
import { getEnv, type Env } from '@server/env'

// Note: The old process.env-based tests were removed as the env module
// now uses Cloudflare Workers bindings (passed to getEnv function)

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
