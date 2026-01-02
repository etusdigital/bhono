import { createMiddleware } from 'hono/factory'
import type { HonoEnv } from '../types'

interface RequestLog {
  level: 'info' | 'warn' | 'error'
  method: string
  path: string
  status: number
  duration: number
  transactionId: string
  ip: string
  userAgent: string
  userId?: string
  timestamp: string
}

function getLogLevel(status: number): 'info' | 'warn' | 'error' {
  if (status >= 500) return 'error'
  if (status >= 400) return 'warn'
  return 'info'
}

export const requestLogger = () =>
  createMiddleware<HonoEnv>(async (c, next) => {
    const start = Date.now()

    await next()

    const duration = Date.now() - start
    const status = c.res.status
    const user = c.get('user')

    const log: RequestLog = {
      level: getLogLevel(status),
      method: c.req.method,
      path: c.req.path,
      status,
      duration,
      transactionId: c.get('transactionId') ?? 'unknown',
      ip: c.get('ip') ?? c.req.header('x-forwarded-for') ?? 'unknown',
      userAgent: c.get('userAgent') ?? c.req.header('user-agent') ?? 'unknown',
      timestamp: new Date().toISOString(),
    }

    if (user?.id) {
      log.userId = user.id
    }

    console.log(JSON.stringify(log))
  })
