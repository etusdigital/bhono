/**
 * Request Logger Middleware
 *
 * Example of structured logging middleware for Cloudflare Workers.
 * Shows timing, context extraction, and JSON logging patterns.
 */

import { createMiddleware } from 'hono/factory'
import type { HonoEnv } from '@server/types'

// ============================================================================
// Types
// ============================================================================

interface LoggerConfig {
  /** Skip logging for certain paths */
  skipPaths?: string[]
  /** Include request body in logs (be careful with sensitive data) */
  logBody?: boolean
  /** Include response body in logs */
  logResponse?: boolean
  /** Max body length to log */
  maxBodyLength?: number
}

interface RequestLog {
  _tag: 'REQUEST'
  transactionId: string | undefined
  method: string
  path: string
  query: Record<string, string>
  ip: string | undefined
  userAgent: string | undefined
  userId: string | undefined
  accountId: string | undefined
  duration: number
  status: number
  body?: unknown
  response?: unknown
}

// ============================================================================
// Request Logger Middleware
// ============================================================================

/**
 * Create request logger middleware
 *
 * @example
 * app.use('/*', requestLogger({
 *   skipPaths: ['/health', '/metrics'],
 *   logBody: false,
 * }))
 */
export function requestLogger(config: LoggerConfig = {}) {
  const {
    skipPaths = ['/health', '/api/health'],
    logBody = false,
    logResponse = false,
    maxBodyLength = 1000,
  } = config

  return createMiddleware<HonoEnv>(async (c, next) => {
    const path = c.req.path

    // Skip certain paths
    if (skipPaths.some((skip) => path.startsWith(skip))) {
      await next()
      return
    }

    const startTime = Date.now()

    // Capture request body if configured
    let requestBody: unknown
    if (logBody && ['POST', 'PUT', 'PATCH'].includes(c.req.method)) {
      try {
        const body = await c.req.text()
        requestBody = body.length > maxBodyLength
          ? `${body.substring(0, maxBodyLength)}... (truncated)`
          : tryParseJson(body)
      } catch {
        // Ignore body parsing errors
      }
    }

    // Execute request
    await next()

    // Calculate duration
    const duration = Date.now() - startTime

    // Build log entry
    const log: RequestLog = {
      _tag: 'REQUEST',
      transactionId: c.get('transactionId'),
      method: c.req.method,
      path,
      query: Object.fromEntries(new URL(c.req.url).searchParams),
      ip: c.get('ip'),
      userAgent: c.get('userAgent'),
      userId: c.get('user')?.id,
      accountId: c.get('accountId'),
      duration,
      status: c.res.status,
    }

    // Add body if captured
    if (requestBody !== undefined) {
      log.body = requestBody
    }

    // Add response if configured (be careful with sensitive data)
    if (logResponse && c.res.status >= 400) {
      try {
        const clone = c.res.clone()
        const text = await clone.text()
        log.response = text.length > maxBodyLength
          ? `${text.substring(0, maxBodyLength)}... (truncated)`
          : tryParseJson(text)
      } catch {
        // Ignore response parsing errors
      }
    }

    // Output structured log
    console.log(JSON.stringify(log))
  })
}

// ============================================================================
// Helper
// ============================================================================

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

// ============================================================================
// Slow Request Logger
// ============================================================================

/**
 * Log slow requests (above threshold)
 *
 * @example
 * app.use('/*', slowRequestLogger({ thresholdMs: 1000 }))
 */
export function slowRequestLogger(config: { thresholdMs: number }) {
  const { thresholdMs } = config

  return createMiddleware<HonoEnv>(async (c, next) => {
    const startTime = Date.now()

    await next()

    const duration = Date.now() - startTime

    if (duration > thresholdMs) {
      console.log(JSON.stringify({
        _tag: 'SLOW_REQUEST',
        transactionId: c.get('transactionId'),
        method: c.req.method,
        path: c.req.path,
        duration,
        threshold: thresholdMs,
        userId: c.get('user')?.id,
      }))
    }
  })
}

// ============================================================================
// Usage Examples
// ============================================================================

/*
// In src/server/index.ts

import { requestLogger, slowRequestLogger } from '@server/middleware/request-logger'

// Log all requests (except health checks)
app.use('/*', requestLogger({
  skipPaths: ['/health', '/api/health', '/favicon.ico'],
}))

// Alert on slow requests (>2 seconds)
app.use('/api/*', slowRequestLogger({ thresholdMs: 2000 }))
*/
