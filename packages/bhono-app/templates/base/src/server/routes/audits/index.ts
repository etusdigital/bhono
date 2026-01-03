// src/server/routes/audits/index.ts
import { OpenAPIHono } from '@hono/zod-openapi'
import type { HonoEnv } from '../../types'
import { requireRole } from '../../auth/guards'
import { listAuditLogsRoute } from './routes'
import { listAuditLogsHandler } from './handlers'

const audits = new OpenAPIHono<HonoEnv>()

// List audit logs - requires ADMIN role or ANALYTICS role
audits.use(listAuditLogsRoute.path, requireRole('ADMIN', ['ANALYTICS']))
audits.openapi(listAuditLogsRoute, listAuditLogsHandler)

export { audits }
