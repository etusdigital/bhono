// src/server/routes/storage/index.ts
import { OpenAPIHono } from '@hono/zod-openapi'
import type { HonoEnv } from '../../types'
import { requireRole } from '../../auth/guards'
import {
  generateUploadUrlRoute,
  uploadFileRoute,
  deleteFileRoute,
} from './routes'
import {
  generateUploadUrlHandler,
  uploadFileHandler,
  deleteFileHandler,
} from './handlers'

const storage = new OpenAPIHono<HonoEnv>()

// Generate upload URL - requires AUTHOR role or higher (anyone who can create content)
storage.use('/upload-url', requireRole('AUTHOR'))
storage.openapi(generateUploadUrlRoute, generateUploadUrlHandler)

// Upload file - requires AUTHOR role or higher
// Note: Use wildcard pattern for middleware (OpenAPI uses {key}, Hono uses /*)
storage.use('/upload/*', requireRole('AUTHOR'))
storage.openapi(uploadFileRoute, uploadFileHandler)

// Delete file - requires EDITOR role or higher
// This applies to paths like /:key but not to /upload-url or /upload/*
// We need to apply it more specifically - use a middleware that checks the path
storage.use('/:key', async (c, next) => {
  // Skip if this is the upload-url endpoint or upload/* endpoint
  const path = c.req.path
  if (path.includes('/upload-url') || path.includes('/upload/')) {
    return next()
  }
  // Apply EDITOR role check for delete operations
  return requireRole('EDITOR')(c, next)
})
storage.openapi(deleteFileRoute, deleteFileHandler)

export { storage }
