/**
 * Header Validator Middleware
 *
 * Example of request validation middleware.
 * Shows how to validate required headers and sanitize inputs.
 */

import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import type { HonoEnv } from '@server/types'

// ============================================================================
// Required Headers Middleware
// ============================================================================

interface RequiredHeadersConfig {
  headers: string[]
  message?: string
}

/**
 * Ensure required headers are present
 *
 * @example
 * app.use('/api/*', requireHeaders({
 *   headers: ['account-id', 'x-request-id'],
 * }))
 */
export function requireHeaders(config: RequiredHeadersConfig) {
  const { headers, message = 'Missing required header' } = config

  return createMiddleware<HonoEnv>(async (c, next) => {
    const missing: string[] = []

    for (const header of headers) {
      if (!c.req.header(header)) {
        missing.push(header)
      }
    }

    if (missing.length > 0) {
      throw new HTTPException(400, {
        message: `${message}: ${missing.join(', ')}`,
        cause: { missingHeaders: missing },
      })
    }

    await next()
  })
}

// ============================================================================
// Content-Type Validator
// ============================================================================

interface ContentTypeConfig {
  allowedTypes: string[]
  methods?: string[]
}

/**
 * Validate Content-Type header for specific methods
 *
 * @example
 * app.use('/api/*', validateContentType({
 *   allowedTypes: ['application/json'],
 *   methods: ['POST', 'PUT', 'PATCH'],
 * }))
 */
export function validateContentType(config: ContentTypeConfig) {
  const {
    allowedTypes,
    methods = ['POST', 'PUT', 'PATCH'],
  } = config

  return createMiddleware<HonoEnv>(async (c, next) => {
    if (!methods.includes(c.req.method)) {
      await next()
      return
    }

    const contentType = c.req.header('content-type')

    if (!contentType) {
      throw new HTTPException(415, {
        message: 'Content-Type header is required',
      })
    }

    // Check if content type matches any allowed type
    const isAllowed = allowedTypes.some((allowed) =>
      contentType.toLowerCase().includes(allowed.toLowerCase())
    )

    if (!isAllowed) {
      throw new HTTPException(415, {
        message: `Unsupported Content-Type: ${contentType}. Allowed: ${allowedTypes.join(', ')}`,
      })
    }

    await next()
  })
}

// ============================================================================
// API Version Validator
// ============================================================================

interface ApiVersionConfig {
  headerName?: string
  supportedVersions: string[]
  defaultVersion?: string
}

/**
 * Validate API version header
 *
 * @example
 * app.use('/api/*', validateApiVersion({
 *   supportedVersions: ['2024-01-01', '2024-06-01'],
 *   defaultVersion: '2024-06-01',
 * }))
 */
export function validateApiVersion(config: ApiVersionConfig) {
  const {
    headerName = 'x-api-version',
    supportedVersions,
    defaultVersion,
  } = config

  return createMiddleware<HonoEnv>(async (c, next) => {
    let version = c.req.header(headerName)

    // Use default if not provided
    if (!version && defaultVersion) {
      version = defaultVersion
    }

    if (version && !supportedVersions.includes(version)) {
      throw new HTTPException(400, {
        message: `Unsupported API version: ${version}. Supported: ${supportedVersions.join(', ')}`,
        cause: { providedVersion: version, supportedVersions },
      })
    }

    // Store version in context for handlers to use
    if (version) {
      c.set('apiVersion' as keyof HonoEnv['Variables'], version)
    }

    await next()
  })
}

// ============================================================================
// Request ID Middleware
// ============================================================================

/**
 * Ensure request has a unique ID (generate if missing)
 *
 * @example
 * app.use('/*', ensureRequestId())
 */
export function ensureRequestId(headerName = 'x-request-id') {
  return createMiddleware<HonoEnv>(async (c, next) => {
    let requestId = c.req.header(headerName)

    if (!requestId) {
      requestId = crypto.randomUUID()
    }

    // Store in context
    c.set('transactionId', requestId)

    // Add to response headers
    c.header(headerName, requestId)

    await next()
  })
}

// ============================================================================
// Usage Examples
// ============================================================================

/*
// In src/server/index.ts

import {
  requireHeaders,
  validateContentType,
  validateApiVersion,
  ensureRequestId,
} from '@server/middleware/header-validator'

// Ensure every request has a transaction ID
app.use('/*', ensureRequestId())

// Require account-id header for API routes
app.use('/api/*', requireHeaders({
  headers: ['account-id'],
}))

// Validate Content-Type for mutating requests
app.use('/api/*', validateContentType({
  allowedTypes: ['application/json'],
}))

// Optional: API versioning
app.use('/api/*', validateApiVersion({
  supportedVersions: ['2024-01-01', '2024-06-01'],
  defaultVersion: '2024-06-01',
}))
*/
