// src/middleware/request-context.ts
import { createMiddleware } from 'hono/factory'
import { uuidv7 } from 'uuidv7'
import type { HonoEnv } from '../types'

export const requestContext = createMiddleware<HonoEnv>(async (c, next) => {
  // Set transaction ID (UUIDv7)
  c.set('transactionId', uuidv7())

  // Set IP address (take first IP from X-Forwarded-For if present)
  const forwardedFor = c.req.header('x-forwarded-for')
  const ip = forwardedFor
    ? forwardedFor.split(',')[0].trim()
    : (c.req.header('x-real-ip') ?? 'unknown')
  c.set('ip', ip)

  // Set User Agent
  const userAgent = c.req.header('user-agent') ?? 'unknown'
  c.set('userAgent', userAgent)

  // Initialize user and account context (will be set by auth middleware)
  c.set('user', null)
  c.set('accountId', '')
  c.set('userRole', null)
  c.set('isSystemAdminAccess', false)

  await next()
})
