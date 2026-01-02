// src/server/env.ts
export interface Env {
  // D1 Database (may be undefined in test environments)
  DB?: D1Database

  // KV Sessions (may be undefined in test environments)
  SESSIONS?: KVNamespace

  // Static Assets (may be undefined in test environments)
  ASSETS?: Fetcher

  // R2 Storage (may be undefined in test environments)
  R2_BUCKET?: R2Bucket
  R2_PUBLIC_URL?: string

  // Environment
  ENVIRONMENT: string

  // App URL
  APP_URL: string

  // JWT
  JWT_SECRET: string
  JWT_EXPIRY_MINUTES: string

  // Google OAuth
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  GOOGLE_REDIRECT_URI: string

  // Refresh Token
  REFRESH_TOKEN_EXPIRY_DAYS: string

  // SendGrid
  SENDGRID_API_KEY: string
  SENDGRID_FROM_EMAIL: string

  // CORS
  CORS_ORIGINS?: string
}

// Helper to get env with defaults
export function getEnv(env: Env) {
  return {
    ...env,
    JWT_EXPIRY_MINUTES: Number.parseInt(env.JWT_EXPIRY_MINUTES || '15', 10),
    REFRESH_TOKEN_EXPIRY_DAYS: Number.parseInt(env.REFRESH_TOKEN_EXPIRY_DAYS || '30', 10),
    CORS_ORIGINS_LIST: env.CORS_ORIGINS
      ? env.CORS_ORIGINS.split(',').map((o) => o.trim())
      : [],
  }
}
