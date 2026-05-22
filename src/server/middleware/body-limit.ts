import { bodyLimit } from 'hono/body-limit'
import { createMiddleware } from 'hono/factory'
import type { HonoEnv } from '../types'

const DEFAULT_JSON_BODY_LIMIT_BYTES = 1024 * 1024

function isJsonContentType(contentType: string | undefined): boolean {
  const mediaType = contentType?.split(';', 1)[0]?.trim().toLowerCase()
  return mediaType === 'application/json' || mediaType?.endsWith('+json') === true
}

function isStorageUploadPath(path: string): boolean {
  return /^\/api\/storage\/upload\/.+/.test(path)
}

export function requestBodyLimit(maxSize = DEFAULT_JSON_BODY_LIMIT_BYTES) {
  const limitJsonBody = bodyLimit({
    maxSize,
    onError: (c) => c.json({ error: { message: 'Request body too large' } }, 413),
  })

  return createMiddleware<HonoEnv>(async (c, next) => {
    if (!c.req.raw.body || isStorageUploadPath(c.req.path)) {
      return next()
    }

    if (!isJsonContentType(c.req.header('Content-Type'))) {
      return next()
    }

    return limitJsonBody(c, next)
  })
}
