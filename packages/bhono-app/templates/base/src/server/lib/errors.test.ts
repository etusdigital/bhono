import { describe, it, expect } from 'vitest'
import {
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  InternalError,
  getErrorCode,
} from './errors'

describe('Error Classes', () => {
  describe('getErrorCode', () => {
    it('returns VALIDATION_ERROR for ValidationError', () => {
      const error = new ValidationError('Invalid input')
      expect(getErrorCode(error)).toBe('VALIDATION_ERROR')
    })

    it('returns UNAUTHORIZED for UnauthorizedError', () => {
      const error = new UnauthorizedError()
      expect(getErrorCode(error)).toBe('UNAUTHORIZED')
    })

    it('returns FORBIDDEN for ForbiddenError', () => {
      const error = new ForbiddenError()
      expect(getErrorCode(error)).toBe('FORBIDDEN')
    })

    it('returns NOT_FOUND for NotFoundError', () => {
      const error = new NotFoundError('User')
      expect(getErrorCode(error)).toBe('NOT_FOUND')
    })

    it('returns CONFLICT for ConflictError', () => {
      const error = new ConflictError()
      expect(getErrorCode(error)).toBe('CONFLICT')
    })

    it('returns INTERNAL_ERROR for InternalError', () => {
      const error = new InternalError()
      expect(getErrorCode(error)).toBe('INTERNAL_ERROR')
    })

    it('returns INTERNAL_ERROR for unknown errors', () => {
      const error = new Error('Unknown')
      expect(getErrorCode(error)).toBe('INTERNAL_ERROR')
    })
  })
})
