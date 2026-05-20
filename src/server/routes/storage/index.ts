// src/server/routes/storage/index.ts
import { OpenAPIHono } from '@hono/zod-openapi'
import type { HonoEnv } from '../../types'
import { requirePermission } from '../../auth/guards'
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

// Generate upload URL - requires resources:create
storage.use('/upload-url', requirePermission('resources:create'))
storage.openapi(generateUploadUrlRoute, generateUploadUrlHandler)

// Upload file - requires resources:create
// Note: Use wildcard pattern for middleware (OpenAPI uses {key}, Hono uses /*)
storage.use('/upload/*', requirePermission('resources:create'))
storage.openapi(uploadFileRoute, uploadFileHandler)

// Delete file - requires resources:delete
// This applies to paths like /:key but not to /upload-url or /upload/*
// We need to apply it more specifically - use a middleware that checks the path
storage.use('/:key', async (c, next) => {
  // Skip if this is the upload-url endpoint or upload/* endpoint
  const path = c.req.path
  if (path.includes('/upload-url') || path.includes('/upload/')) {
    return next()
  }
  // Apply delete permission check for delete operations
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- Hono dynamic route typing
  return requirePermission('resources:delete')(c, next)
})
storage.openapi(deleteFileRoute, deleteFileHandler)

export { storage }
