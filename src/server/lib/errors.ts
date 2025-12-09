import { HTTPException } from 'hono/http-exception'

export class ValidationError extends HTTPException {
  constructor(message: string, details?: unknown) {
    super(400, {
      message,
      cause: details,
    })
  }
}

export class UnauthorizedError extends HTTPException {
  constructor(message = 'Unauthorized') {
    super(401, { message })
  }
}

export class ForbiddenError extends HTTPException {
  constructor(message = 'Forbidden') {
    super(403, { message })
  }
}

export class NotFoundError extends HTTPException {
  constructor(resource = 'Resource') {
    super(404, { message: `${resource} not found` })
  }
}

export class ConflictError extends HTTPException {
  constructor(message = 'Resource already exists') {
    super(409, { message })
  }
}

export class InternalError extends HTTPException {
  constructor(message = 'Internal server error') {
    super(500, { message })
  }
}
