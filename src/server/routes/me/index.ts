// src/server/routes/me/index.ts
//
// The current user's GATEWAY account context (gateway-as-authority, @etus/auth
// v0.9.1). Distinct from `/auth/me` (identity, served by @etus/auth): this returns
// the per-account roles the gateway resolved for the user (viewer/editor/manager/
// admin per account) plus the global super-admin flag — the org-level dimension
// the app reads for authorization, alongside its own local workspaces.
//
// Empty/false when `gatewayAuthority` is disabled, so the client always gets a
// safe shape regardless of env.
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { HonoEnv } from '../../types'
import { getAuth } from '../../auth/setup'
import { resolveMockGatewayContext } from '../../dev/gateway-scenario'

const GatewayAccountSchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    role: z.enum(['viewer', 'editor', 'manager', 'admin']),
  })
  .openapi('GatewayAccount')

const GatewayAccountContextSchema = z
  .object({
    accounts: z.array(GatewayAccountSchema),
    superAdmin: z.boolean(),
  })
  .openapi('GatewayAccountContext')

const getMeRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Me'],
  summary: "The current user's gateway accounts and super-admin flag",
  description:
    'Per-account roles resolved by the gateway via gatewayAuthority. ' +
    'Returns an empty list and superAdmin:false when gatewayAuthority is disabled.',
  security: [{ SessionCookie: [] }],
  responses: {
    200: {
      content: { 'application/json': { schema: GatewayAccountContextSchema } },
      description: "The current user's gateway account context",
    },
  },
})

const me = new OpenAPIHono<HonoEnv>()

me.openapi(getMeRoute, (c) => {
  // Dev-only: a configured gateway mock (ENVIRONMENT!=production + ETUS_GATEWAY_MOCK)
  // short-circuits the real resolution so the multi-tenant UI can be validated and
  // tested without a live gateway. Returns null in production → real path below.
  const mocked = resolveMockGatewayContext(c.env, c.get('authUser')?.email)
  if (mocked) return c.json(mocked, 200)
  const auth = getAuth(c.env)
  return c.json({ accounts: auth.getGatewayAccounts(c), superAdmin: auth.isSuperAdmin(c) }, 200)
})

export { me }
