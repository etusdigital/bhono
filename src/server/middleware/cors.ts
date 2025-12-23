import { cors } from 'hono/cors'

interface CorsConfig {
  corsOrigins: string[]
  appUrl: string
}

/**
 * Configurable CORS middleware.
 * Uses CORS_ORIGINS list if provided, otherwise falls back to APP_URL.
 */
export const configurableCors = (config: CorsConfig) => {
  const allowedOrigins = config.corsOrigins.length > 0
    ? config.corsOrigins
    : [config.appUrl]

  return cors({
    origin: (origin) => {
      if (!origin) return null
      return allowedOrigins.includes(origin) ? origin : null
    },
    credentials: true,
    allowHeaders: ['Content-Type', 'Authorization', 'Account-ID'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
}
