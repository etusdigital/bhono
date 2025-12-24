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
storage.use(generateUploadUrlRoute.path, requireRole('AUTHOR'))
storage.openapi(generateUploadUrlRoute, generateUploadUrlHandler)

// Upload file - requires AUTHOR role or higher
storage.use(uploadFileRoute.path, requireRole('AUTHOR'))
storage.openapi(uploadFileRoute, uploadFileHandler)

// Delete file - requires EDITOR role or higher
storage.use(deleteFileRoute.path, requireRole('EDITOR'))
storage.openapi(deleteFileRoute, deleteFileHandler)

export { storage }
