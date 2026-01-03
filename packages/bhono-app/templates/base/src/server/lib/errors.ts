import { HTTPException } from 'hono/http-exception'

export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]

export class ValidationError extends HTTPException {
  readonly code = ERROR_CODES.VALIDATION_ERROR
  constructor(message: string, details?: unknown) {
    super(400, { message, cause: details })
  }
}

export class UnauthorizedError extends HTTPException {
  readonly code = ERROR_CODES.UNAUTHORIZED
  constructor(message = 'Unauthorized') {
    super(401, { message })
  }
}

export class ForbiddenError extends HTTPException {
  readonly code = ERROR_CODES.FORBIDDEN
  constructor(message = 'Forbidden') {
    super(403, { message })
  }
}

export class NotFoundError extends HTTPException {
  readonly code = ERROR_CODES.NOT_FOUND
  constructor(resource = 'Resource') {
    super(404, { message: `${resource} not found` })
  }
}

export class ConflictError extends HTTPException {
  readonly code = ERROR_CODES.CONFLICT
  constructor(message = 'Resource already exists') {
    super(409, { message })
  }
}

export class InternalError extends HTTPException {
  readonly code = ERROR_CODES.INTERNAL_ERROR
  constructor(message = 'Internal server error') {
    super(500, { message })
  }
}

export function getErrorCode(error: unknown): ErrorCode {
  if (error instanceof ValidationError) return ERROR_CODES.VALIDATION_ERROR
  if (error instanceof UnauthorizedError) return ERROR_CODES.UNAUTHORIZED
  if (error instanceof ForbiddenError) return ERROR_CODES.FORBIDDEN
  if (error instanceof NotFoundError) return ERROR_CODES.NOT_FOUND
  if (error instanceof ConflictError) return ERROR_CODES.CONFLICT
  if (error instanceof InternalError) return ERROR_CODES.INTERNAL_ERROR
  return ERROR_CODES.INTERNAL_ERROR
}
