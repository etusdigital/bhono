import type { ErrorHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { AuthError } from '@etus/auth'
import { getErrorCode } from '../lib/errors'

interface ErrorResponse {
  error: {
    code: string
    message: string
    status: number
    timestamp: string
    details?: unknown
  }
}

function classify(err: Error): { status: number; message: string; code: string } {
  if (err instanceof AuthError) {
    return { status: err.statusCode, message: err.message, code: err.code }
  }
  if (err instanceof HTTPException) {
    return { status: err.status, message: err.message, code: getErrorCode(err) }
  }
  return { status: 500, message: 'Internal server error', code: getErrorCode(err) }
}

export const errorHandler: ErrorHandler = (err, c) => {
  const { status, message, code } = classify(err)
  const details = err instanceof HTTPException ? (err as HTTPException & { cause?: unknown }).cause : undefined

  // Log the error for debugging (use console.log for Cloudflare Workers visibility)
  console.log(JSON.stringify({
    _tag: 'ERROR_HANDLER',
    status,
    code,
    message,
    name: err.name,
    stack: err.stack?.substring(0, 500),
    cause: String((err as Error & { cause?: unknown }).cause),
  }))

  const response: ErrorResponse = {
    error: {
      code,
      message,
      status,
      timestamp: new Date().toISOString(),
      ...(details !== undefined && { details }),
    },
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Hono's StatusCode union is narrower than our dynamic status from AuthError/HTTPException
  return c.json(response, status as any)
}
