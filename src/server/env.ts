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

  // ETUS Auth (OAuth Gateway — @etus/auth)
  ETUS_GATEWAY: string
  ETUS_CLIENT_ID: string
  ETUS_CLIENT_SECRET?: string
  ETUS_ALLOWED_DOMAINS: string
  ETUS_ADMIN_EMAILS: string

  // SendGrid (invitations)
  SENDGRID_API_KEY: string
  SENDGRID_FROM_EMAIL: string

  // CORS
  CORS_ORIGINS?: string

  // Max body size for direct R2 uploads (PUT /api/storage/upload/*).
  // Accepts a positive integer in bytes. Defaults to 25 MiB when unset.
  MAX_UPLOAD_BYTES?: string
}

const DEFAULT_UPLOAD_BYTES = 25 * 1024 * 1024

/**
 * Parse MAX_UPLOAD_BYTES env var into a positive integer.
 * Returns the default (25 MiB) when unset; throws when set to garbage.
 */
export function parseUploadBytes(raw: string | undefined): number {
  if (raw === undefined || raw === '') return DEFAULT_UPLOAD_BYTES
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
    throw new Error(`MAX_UPLOAD_BYTES must be a positive integer in bytes, got: ${raw}`)
  }
  return parsed
}

// Helper to get env with derived values
export function getEnv(env: Env) {
  return {
    ...env,
    CORS_ORIGINS_LIST: parseList(env.CORS_ORIGINS),
  }
}

function parseList(csv: string | undefined): string[] {
  return (csv ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

/**
 * Validate environment variables at startup.
 * Throws an error if the auth gateway configuration is missing.
 */
export function validateEnv(env: Env, options: { allowMissingClientSecret?: boolean } = {}): void {
  if (!env.ETUS_GATEWAY) {
    throw new Error('ETUS_GATEWAY is required')
  }
  if (!env.ETUS_CLIENT_ID) {
    throw new Error('ETUS_CLIENT_ID is required')
  }
  const requiresGatewaySecret = env.ENVIRONMENT === 'production' || env.ENVIRONMENT === 'staging'
  if (requiresGatewaySecret && !env.ETUS_CLIENT_SECRET && !options.allowMissingClientSecret) {
    throw new Error('ETUS_CLIENT_SECRET is required')
  }
  if (parseList(env.ETUS_ALLOWED_DOMAINS).length === 0) {
    throw new Error('ETUS_ALLOWED_DOMAINS must include at least one domain')
  }
  if (parseList(env.ETUS_ADMIN_EMAILS).length === 0) {
    throw new Error('ETUS_ADMIN_EMAILS must include at least one admin email')
  }
  if (env.ENVIRONMENT === 'production' && parseList(env.CORS_ORIGINS).includes('*')) {
    throw new Error('CORS_ORIGINS must not contain * in production')
  }
  // Validate MAX_UPLOAD_BYTES eagerly so we fail at first request with a clear
  // message instead of falling back to the default silently.
  parseUploadBytes(env.MAX_UPLOAD_BYTES)
}
