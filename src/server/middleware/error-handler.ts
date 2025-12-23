import type { ErrorHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { getErrorCode, type ErrorCode } from '../lib/errors'

interface ErrorResponse {
  error: {
    code: ErrorCode
    message: string
    status: number
    timestamp: string
    details?: unknown
  }
}

export const errorHandler: ErrorHandler = (err, c) => {
  const status = err instanceof HTTPException ? err.status : 500
  const message = err instanceof HTTPException ? err.message : 'Internal server error'
  const code = getErrorCode(err)
  const details = err instanceof HTTPException ? err.cause : undefined

  const response: ErrorResponse = {
    error: {
      code,
      message,
      status,
      timestamp: new Date().toISOString(),
      ...(details !== undefined && { details }),
    },
  }

  return c.json(response, status)
}
