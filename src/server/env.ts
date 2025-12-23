// src/server/env.ts
export interface Env {
  // D1 Database
  DB: D1Database

  // Static Assets
  ASSETS: Fetcher

  // R2 Storage
  R2_BUCKET: R2Bucket
  R2_PUBLIC_URL: string

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
    JWT_EXPIRY_MINUTES: parseInt(env.JWT_EXPIRY_MINUTES || '15', 10),
    REFRESH_TOKEN_EXPIRY_DAYS: parseInt(env.REFRESH_TOKEN_EXPIRY_DAYS || '30', 10),
    CORS_ORIGINS_LIST: env.CORS_ORIGINS
      ? env.CORS_ORIGINS.split(',').map((o) => o.trim())
      : [],
  }
}
