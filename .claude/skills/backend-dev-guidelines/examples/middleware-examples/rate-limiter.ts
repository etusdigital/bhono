/**
 * Rate Limiter Middleware
 *
 * Example of custom middleware using Cloudflare KV for rate limiting.
 * Shows createMiddleware pattern and KV operations.
 */

import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import type { HonoEnv } from '@server/types'

// ============================================================================
// Types
// ============================================================================

interface RateLimitConfig {
  /** Maximum requests allowed in window */
  limit: number
  /** Time window in seconds */
  windowSeconds: number
  /** Key prefix for KV storage */
  keyPrefix?: string
  /** Skip rate limiting for super admins */
  skipSuperAdmin?: boolean
}

interface RateLimitData {
  count: number
  resetAt: number
}

// ============================================================================
// Rate Limiter Middleware Factory
// ============================================================================

/**
 * Create rate limiter middleware
 *
 * @example
 * // 100 requests per minute
 * app.use('/api/*', rateLimiter({ limit: 100, windowSeconds: 60 }))
 *
 * // 10 requests per hour for auth endpoints
 * app.use('/api/auth/*', rateLimiter({ limit: 10, windowSeconds: 3600, keyPrefix: 'auth' }))
 */
export function rateLimiter(config: RateLimitConfig) {
  const {
    limit,
    windowSeconds,
    keyPrefix = 'ratelimit',
    skipSuperAdmin = true,
  } = config

  return createMiddleware<HonoEnv>(async (c, next) => {
    // Skip if no KV binding
    const kv = c.env?.RATE_LIMIT_KV
    if (!kv) {
      console.log(JSON.stringify({
        _tag: 'RATE_LIMIT_SKIP',
        reason: 'No KV binding',
      }))
      await next()
      return
    }

    // Skip for super admins if configured
    if (skipSuperAdmin && c.get('user')?.isSuperAdmin) {
      await next()
      return
    }

    // Build rate limit key (by IP or user ID)
    const userId = c.get('user')?.id
    const ip = c.get('ip') ?? c.req.header('cf-connecting-ip') ?? 'unknown'
    const identifier = userId ?? ip
    const key = `${keyPrefix}:${identifier}`

    // Get current rate limit data
    const data = await kv.get<RateLimitData>(key, 'json')
    const now = Date.now()

    if (data && data.resetAt > now) {
      // Within window - check limit
      if (data.count >= limit) {
        // Rate limited
        const retryAfter = Math.ceil((data.resetAt - now) / 1000)

        throw new HTTPException(429, {
          message: 'Too many requests',
          cause: {
            retryAfter,
            limit,
            remaining: 0,
          },
        })
      }

      // Increment counter
      await kv.put(
        key,
        JSON.stringify({ count: data.count + 1, resetAt: data.resetAt }),
        { expirationTtl: windowSeconds }
      )

      // Set rate limit headers
      c.header('X-RateLimit-Limit', limit.toString())
      c.header('X-RateLimit-Remaining', (limit - data.count - 1).toString())
      c.header('X-RateLimit-Reset', Math.ceil(data.resetAt / 1000).toString())
    } else {
      // New window - start fresh
      const resetAt = now + windowSeconds * 1000
      await kv.put(
        key,
        JSON.stringify({ count: 1, resetAt }),
        { expirationTtl: windowSeconds }
      )

      c.header('X-RateLimit-Limit', limit.toString())
      c.header('X-RateLimit-Remaining', (limit - 1).toString())
      c.header('X-RateLimit-Reset', Math.ceil(resetAt / 1000).toString())
    }

    await next()
  })
}

// ============================================================================
// Usage Examples
// ============================================================================

/*
// In routes/index.ts

import { rateLimiter } from '@server/middleware/rate-limiter'

// Global rate limit: 1000 requests per minute
api.use('/*', rateLimiter({ limit: 1000, windowSeconds: 60 }))

// Stricter limit for auth endpoints: 10 per hour
api.use('/auth/*', rateLimiter({
  limit: 10,
  windowSeconds: 3600,
  keyPrefix: 'auth',
}))

// Very strict for password reset: 3 per hour
api.use('/auth/reset-password', rateLimiter({
  limit: 3,
  windowSeconds: 3600,
  keyPrefix: 'reset',
}))
*/
