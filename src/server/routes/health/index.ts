import { OpenAPIHono } from '@hono/zod-openapi'
import type { HonoEnv } from '../../types'
import { healthRoute, readyRoute, liveRoute } from './routes'
import { handleHealth, handleReady, handleLive } from './handlers'

const health = new OpenAPIHono<HonoEnv>()

// Mount routes (no auth required for health checks)
health.openapi(healthRoute, handleHealth)
health.openapi(readyRoute, handleReady)
health.openapi(liveRoute, handleLive)

export { health }
