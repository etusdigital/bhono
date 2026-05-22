import { cors } from 'hono/cors'

interface CorsConfig {
  corsOrigins: string[]
  appUrl: string
}

/**
 * Configurable CORS middleware.
 * Uses CORS_ORIGINS list if provided, otherwise falls back to APP_URL.
 * Credentialed browser requests never allow wildcard origins.
 */
export const configurableCors = (config: CorsConfig) => {
  const configuredOrigins = config.corsOrigins.filter((origin) => origin !== '*')
  const allowedOrigins = new Set([
    config.appUrl,
    ...configuredOrigins,
  ])

  return cors({
    origin: (origin) => {
      if (!origin) return null
      return allowedOrigins.has(origin) ? origin : null
    },
    credentials: true,
    allowHeaders: ['Content-Type', 'X-CSRF-Token', 'X-Requested-With', 'X-Account-ID', 'Account-ID'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
}
