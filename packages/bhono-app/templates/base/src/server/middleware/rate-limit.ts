/**
 * Rate Limiting Middleware
 *
 * Provides rate limiting protection against API abuse using an in-memory store.
 * Can be configured per-route with different limits and windows.
 *
 * For production with multiple Workers instances, consider using
 * Cloudflare Rate Limiting or a distributed store like Durable Objects.
 */

import { createMiddleware } from 'hono/factory'
import type { HonoEnv } from '../types'

// ============================================================================
// TYPES
// ============================================================================

export interface RateLimitOptions {
  /** Time window in milliseconds (default: 60000 = 1 minute) */
  windowMs?: number
  /** Maximum requests per window (default: 100) */
  max?: number
  /** Key generator function - defaults to IP address */
  keyGenerator?: (c: Parameters<ReturnType<typeof createMiddleware<HonoEnv>>>[0]) => string
  /** Custom message for rate limit exceeded response */
  message?: string
  /** Whether to include standard rate limit headers (default: true) */
  standardHeaders?: boolean
  /** Skip rate limiting for certain requests */
  skip?: (c: Parameters<ReturnType<typeof createMiddleware<HonoEnv>>>[0]) => boolean
}

interface RateLimitRecord {
  count: number
  resetTime: number
}

// ============================================================================
// IN-MEMORY STORE
// ============================================================================

/**
 * In-memory rate limit store.
 * Note: This is process-local and won't work correctly with multiple Workers instances.
 * For production, use Cloudflare Rate Limiting or Durable Objects.
 */
class RateLimitStore {
  private store = new Map<string, RateLimitRecord>()
  private cleanupInterval: ReturnType<typeof setInterval> | null = null
  private lastCleanup = 0

  // Note: Don't use setInterval at construction time - Cloudflare Workers
  // don't allow async I/O at global scope. Instead, we cleanup lazily.

  /**
   * Start periodic cleanup (call from within a handler, not at global scope)
   */
  startPeriodicCleanup(): void {
    if (this.cleanupInterval) return
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 60000)
  }

  get(key: string): RateLimitRecord | undefined {
    return this.store.get(key)
  }

  set(key: string, record: RateLimitRecord): void {
    this.store.set(key, record)
  }

  increment(key: string, windowMs: number): RateLimitRecord {
    const now = Date.now()

    // Lazy cleanup: run cleanup every 60 seconds during request processing
    // This avoids using setInterval at global scope (not allowed in Workers)
    if (now - this.lastCleanup > 60000) {
      this.cleanup()
      this.lastCleanup = now
    }

    const existing = this.store.get(key)

    if (!existing || now > existing.resetTime) {
      // Start new window
      const record: RateLimitRecord = {
        count: 1,
        resetTime: now + windowMs,
      }
      this.store.set(key, record)
      return record
    }

    // Increment existing window
    existing.count++
    return existing
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [key, record] of this.store.entries()) {
      if (now > record.resetTime) {
        this.store.delete(key)
      }
    }
  }

  /**
   * Clear all entries (useful for testing)
   */
  clear(): void {
    this.store.clear()
  }

  /**
   * Stop the cleanup interval (useful for testing)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }

  /**
   * Get the current size of the store (useful for testing)
   */
  get size(): number {
    return this.store.size
  }
}

// Global store instance
const globalStore = new RateLimitStore()

// Export for testing
export { RateLimitStore, globalStore }

// ============================================================================
// MIDDLEWARE
// ============================================================================

/**
 * Default key generator - uses IP address from request context
 */
function defaultKeyGenerator(c: Parameters<ReturnType<typeof createMiddleware<HonoEnv>>>[0]): string {
  // Try to get IP from context (set by request-context middleware)
  const contextIp = c.get('ip')
  if (contextIp && contextIp !== 'unknown') {
    return contextIp
  }

  // Fallback to headers
  const forwardedFor = c.req.header('x-forwarded-for')
  if (forwardedFor) {
    // Take the first IP if there are multiple
    return forwardedFor.split(',')[0].trim()
  }

  const realIp = c.req.header('x-real-ip')
  if (realIp) {
    return realIp
  }

  return 'unknown'
}

/**
 * Create rate limiting middleware
 *
 * @example
 * // Apply global rate limit of 100 requests per minute
 * app.use('*', rateLimit())
 *
 * @example
 * // Apply stricter limit to auth endpoints
 * app.use('/auth/*', rateLimit({ windowMs: 60000, max: 10 }))
 *
 * @example
 * // Custom key generator (e.g., by user ID for authenticated routes)
 * app.use('/api/*', rateLimit({
 *   keyGenerator: (c) => c.get('user')?.id ?? defaultKeyGenerator(c)
 * }))
 */
export function rateLimit(options: RateLimitOptions = {}) {
  const {
    windowMs = 60000, // 1 minute
    max = 100, // 100 requests per window
    keyGenerator = defaultKeyGenerator,
    message = 'Too many requests, please try again later',
    standardHeaders = true,
    skip,
  } = options

  return createMiddleware<HonoEnv>(async (c, next) => {
    // Check if we should skip rate limiting
    if (skip?.(c)) {
      return next()
    }

    const key = `ratelimit:${keyGenerator(c)}`
    const record = globalStore.increment(key, windowMs)

    // Set standard rate limit headers
    if (standardHeaders) {
      c.header('X-RateLimit-Limit', String(max))
      c.header('X-RateLimit-Remaining', String(Math.max(0, max - record.count)))
      c.header('X-RateLimit-Reset', String(Math.ceil(record.resetTime / 1000)))
    }

    // Check if rate limit exceeded
    if (record.count > max) {
      const retryAfter = Math.ceil((record.resetTime - Date.now()) / 1000)

      c.header('Retry-After', String(Math.max(1, retryAfter)))

      return c.json(
        {
          error: {
            message,
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter,
          },
        },
        429
      )
    }

    await next()
  })
}

/**
 * Create a stricter rate limit for sensitive endpoints (e.g., auth)
 */
export function authRateLimit() {
  return rateLimit({
    windowMs: 60000, // 1 minute
    max: 10, // 10 requests per minute for login endpoints (brute force protection)
    message: 'Too many authentication attempts, please try again later',
    // Use separate key prefix to not conflict with global rate limit
    keyGenerator: (c) => {
      const ip = c.get('ip') ?? c.req.header('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
      return `auth:${ip}` // Different prefix than global rate limit
    },
  })
}

/**
 * Create rate limit with custom store (useful for testing)
 */
export function rateLimitWithStore(store: RateLimitStore, options: RateLimitOptions = {}) {
  const {
    windowMs = 60000,
    max = 100,
    keyGenerator = defaultKeyGenerator,
    message = 'Too many requests, please try again later',
    standardHeaders = true,
    skip,
  } = options

  return createMiddleware<HonoEnv>(async (c, next) => {
    if (skip?.(c)) {
      return next()
    }

    const key = `ratelimit:${keyGenerator(c)}`
    const record = store.increment(key, windowMs)

    if (standardHeaders) {
      c.header('X-RateLimit-Limit', String(max))
      c.header('X-RateLimit-Remaining', String(Math.max(0, max - record.count)))
      c.header('X-RateLimit-Reset', String(Math.ceil(record.resetTime / 1000)))
    }

    if (record.count > max) {
      const retryAfter = Math.ceil((record.resetTime - Date.now()) / 1000)

      c.header('Retry-After', String(Math.max(1, retryAfter)))

      return c.json(
        {
          error: {
            message,
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter,
          },
        },
        429
      )
    }

    await next()
  })
}
