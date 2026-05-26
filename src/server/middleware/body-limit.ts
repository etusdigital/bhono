import { bodyLimit } from 'hono/body-limit'
import { createMiddleware } from 'hono/factory'
import type { HonoEnv } from '../types'

const DEFAULT_BODY_LIMIT_BYTES = 1024 * 1024
const DEFAULT_UPLOAD_BODY_LIMIT_BYTES = 25 * 1024 * 1024

function isStorageUploadPath(path: string): boolean {
  return /^\/api\/storage\/upload\/.+/.test(path)
}

function makeBodyLimiter(maxSize: number) {
  return bodyLimit({
    maxSize,
    onError: (c) => c.json({ error: { message: 'Request body too large' } }, 413),
  })
}

export function requestBodyLimit(
  maxSize = DEFAULT_BODY_LIMIT_BYTES,
  uploadMaxSize = DEFAULT_UPLOAD_BODY_LIMIT_BYTES,
) {
  const limitDefaultBody = makeBodyLimiter(maxSize)
  const limitStorageUploadBody = makeBodyLimiter(uploadMaxSize)

  return createMiddleware<HonoEnv>(async (c, next) => {
    if (!c.req.raw.body) {
      return next()
    }

    return isStorageUploadPath(c.req.path)
      ? limitStorageUploadBody(c, next)
      : limitDefaultBody(c, next)
  })
}
