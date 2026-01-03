import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { errorHandler } from './error-handler'
import { ValidationError, NotFoundError, InternalError } from '../lib/errors'

describe('errorHandler', () => {
  const createApp = () => {
    const app = new Hono()
    app.onError(errorHandler)
    return app
  }

  it('handles ValidationError with correct format', async () => {
    const app = createApp()
    app.get('/test', () => {
      throw new ValidationError('Invalid email', { field: 'email' })
    })

    const res = await app.request('/test')
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.message).toBe('Invalid email')
    expect(body.error.status).toBe(400)
    expect(body.error.timestamp).toBeDefined()
    expect(body.error.details).toEqual({ field: 'email' })
  })

  it('handles NotFoundError', async () => {
    const app = createApp()
    app.get('/test', () => {
      throw new NotFoundError('User')
    })

    const res = await app.request('/test')
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error.code).toBe('NOT_FOUND')
    expect(body.error.message).toBe('User not found')
  })

  it('handles unknown errors as INTERNAL_ERROR', async () => {
    const app = createApp()
    app.get('/test', () => {
      throw new Error('Something went wrong')
    })

    const res = await app.request('/test')
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error.code).toBe('INTERNAL_ERROR')
    expect(body.error.message).toBe('Internal server error')
  })

  it('includes timestamp in ISO format', async () => {
    const app = createApp()
    app.get('/test', () => {
      throw new NotFoundError('Resource')
    })

    const res = await app.request('/test')
    const body = await res.json()

    expect(() => new Date(body.error.timestamp)).not.toThrow()
  })
})
