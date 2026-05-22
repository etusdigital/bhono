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
}
