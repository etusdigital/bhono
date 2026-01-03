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

  // Super Admin emails (comma-separated)
  SUPER_ADMIN_EMAILS?: string
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
    SUPER_ADMIN_EMAILS_LIST: env.SUPER_ADMIN_EMAILS
      ? env.SUPER_ADMIN_EMAILS.split(',').map((e) => e.trim().toLowerCase())
      : [],
  }
}

// Check if email is a super admin
export function isSuperAdminEmail(env: Env, email: string): boolean {
  const { SUPER_ADMIN_EMAILS_LIST } = getEnv(env)
  return SUPER_ADMIN_EMAILS_LIST.includes(email.toLowerCase())
}

// Minimum required length for JWT_SECRET (security requirement)
export const JWT_SECRET_MIN_LENGTH = 32

/**
 * Validate environment variables at startup
 * Throws an error if validation fails
 */
export function validateEnv(env: Env): void {
  // JWT_SECRET must be at least 32 characters for security
  if (!env.JWT_SECRET || env.JWT_SECRET.length < JWT_SECRET_MIN_LENGTH) {
    throw new Error(`JWT_SECRET must be at least ${String(JWT_SECRET_MIN_LENGTH)} characters`)
  }
}
