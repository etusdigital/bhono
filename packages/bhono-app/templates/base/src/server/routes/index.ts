import { OpenAPIHono } from '@hono/zod-openapi'
import { NONCE } from 'hono/secure-headers'
import type { HonoEnv } from '../types'
import { storage } from './storage'
import { me } from './me'
import { openApiConfig } from './openapi'

// Application API router. Identity/tenancy routes (users, accounts,
// invitations, audit) are served by @etus/auth and mounted directly in
// index.ts — this router carries only the boilerplate's own resources.
const api = new OpenAPIHono<HonoEnv>()

api.route('/storage', storage)
api.route('/me', me)

// Session cookie auth scheme (issued by @etus/auth on login)
api.openAPIRegistry.registerComponent('securitySchemes', 'SessionCookie', {
  type: 'apiKey',
  in: 'cookie',
  name: 'auth_sid',
  description: 'Session cookie authentication. Login via /auth/login to obtain a session.',
})

api.doc('/doc', openApiConfig)
api.get('/swagger', (c) => {
  const cspNonce = NONCE(c, 'script-src')
  const nonce = cspNonce.slice("'nonce-".length, -1)

  return c.html(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="SwaggerUI" />
    <title>Hono Boilerplate API</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist/swagger-ui-bundle.js" crossorigin="anonymous"></script>
    <script nonce="${nonce}">
      window.onload = () => {
        window.ui = SwaggerUIBundle({
          dom_id: '#swagger-ui',
          url: '/api/doc',
        })
      }
    </script>
  </body>
</html>`)
})

export { api }
export { storage } from './storage'
export { health } from './health'
