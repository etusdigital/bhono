import { describe, it, expect } from 'vitest'
import { getEnv, validateEnv, type Env } from '@server/env'

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
      ETUS_GATEWAY: 'https://ag.etus.io',
      ETUS_CLIENT_ID: 'test-client-id',
      ETUS_CLIENT_SECRET: 'test-client-secret',
      ETUS_ALLOWED_DOMAINS: 'example.com',
      ETUS_ADMIN_EMAILS: 'admin@example.com',
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
      ETUS_GATEWAY: 'https://ag.etus.io',
      ETUS_CLIENT_ID: 'test-client-id',
      ETUS_CLIENT_SECRET: 'test-client-secret',
      ETUS_ALLOWED_DOMAINS: 'example.com',
      ETUS_ADMIN_EMAILS: 'admin@example.com',
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
      ETUS_GATEWAY: 'https://ag.etus.io',
      ETUS_CLIENT_ID: 'test-client-id',
      ETUS_CLIENT_SECRET: 'test-client-secret',
      ETUS_ALLOWED_DOMAINS: 'example.com',
      ETUS_ADMIN_EMAILS: 'admin@example.com',
      SENDGRID_API_KEY: 'test-api-key',
      SENDGRID_FROM_EMAIL: 'test@example.com',
    } as Env

    const result = getEnv(mockEnv)

    expect(result.CORS_ORIGINS_LIST).toEqual([])
  })
})

describe('validateEnv', () => {
  const validEnv = {
    ENVIRONMENT: 'production',
    APP_URL: 'https://app.example.com',
    ETUS_GATEWAY: 'https://ag.etus.io',
    ETUS_CLIENT_ID: 'test-client-id',
    ETUS_CLIENT_SECRET: 'test-client-secret',
    ETUS_ALLOWED_DOMAINS: 'example.com',
    ETUS_ADMIN_EMAILS: 'admin@example.com',
    SENDGRID_API_KEY: 'test-api-key',
    SENDGRID_FROM_EMAIL: 'test@example.com',
  } as Env

  it('accepts a production CORS allowlist', () => {
    expect(() => {
      validateEnv({ ...validEnv, CORS_ORIGINS: 'https://app.example.com' })
    }).not.toThrow()
  })

  it('rejects wildcard CORS in production because credentials are enabled', () => {
    expect(() => {
      validateEnv({ ...validEnv, CORS_ORIGINS: '*' })
    }).toThrow('CORS_ORIGINS must not contain * in production')
  })

  it('allows wildcard CORS only outside production for local debugging', () => {
    expect(() => {
      validateEnv({ ...validEnv, ENVIRONMENT: 'development', CORS_ORIGINS: '*' })
    }).not.toThrow()
  })

  it('rejects missing ETUS client secret outside local/test environments', () => {
    expect(() => {
      validateEnv({ ...validEnv, ETUS_CLIENT_SECRET: '' })
    }).toThrow('ETUS_CLIENT_SECRET is required')
  })

  it('allows missing ETUS client secret in development so test-login can run locally', () => {
    expect(() => {
      validateEnv({ ...validEnv, ENVIRONMENT: 'development', ETUS_CLIENT_SECRET: '' })
    }).not.toThrow()
  })

  it('allows missing ETUS client secret for loopback-only local runtime checks', () => {
    expect(() => {
      validateEnv({ ...validEnv, ETUS_CLIENT_SECRET: '' }, { allowMissingClientSecret: true })
    }).not.toThrow()
  })

  it('rejects empty allowed domain lists before @etus/auth initialization', () => {
    expect(() => {
      validateEnv({ ...validEnv, ETUS_ALLOWED_DOMAINS: ' , ' })
    }).toThrow('ETUS_ALLOWED_DOMAINS must include at least one domain')
  })

  it('rejects empty admin email lists before @etus/auth initialization', () => {
    expect(() => {
      validateEnv({ ...validEnv, ETUS_ADMIN_EMAILS: '' })
    }).toThrow('ETUS_ADMIN_EMAILS must include at least one admin email')
  })
})
