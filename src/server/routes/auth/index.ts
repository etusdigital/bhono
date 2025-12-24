// src/routes/auth/index.ts
import { OpenAPIHono } from '@hono/zod-openapi'
import type { HonoEnv } from '../../types'
import {
  loginRoute,
  callbackRoute,
  refreshRoute,
  logoutRoute,
  meRoute,
  inviteRoute,
} from './routes'
import {
  loginHandler,
  callbackHandler,
  refreshHandler,
  logoutHandler,
  meHandler,
  inviteHandler,
} from './handlers'

const auth = new OpenAPIHono<HonoEnv>()

// Public routes (no auth required)
auth.openapi(loginRoute, loginHandler)
auth.openapi(callbackRoute, callbackHandler)
auth.openapi(refreshRoute, refreshHandler)
auth.openapi(logoutRoute, logoutHandler)
auth.openapi(inviteRoute, inviteHandler)

// Session-based route (validates session in handler via getSession)
auth.openapi(meRoute, meHandler)

export { auth }
