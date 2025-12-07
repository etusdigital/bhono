// src/app.ts
import { OpenAPIHono } from '@hono/zod-openapi'
import type { HonoEnv } from './types'

export const createApp = () => {
  const app = new OpenAPIHono<HonoEnv>({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json(
          {
            error: 'Validation Error',
            statusCode: 400,
            details: result.error.flatten(),
          },
          400
        )
      }
    },
  })

  // Global error handler
  app.onError((err, c) => {
    console.error('Error:', err)

    if ('status' in err && typeof err.status === 'number') {
      return c.json(
        {
          error: err.message || 'Error',
          statusCode: err.status,
        },
        err.status as 400 | 401 | 403 | 404 | 409 | 500
      )
    }

    return c.json(
      {
        error: 'Internal Server Error',
        statusCode: 500,
      },
      500
    )
  })

  return app
}
