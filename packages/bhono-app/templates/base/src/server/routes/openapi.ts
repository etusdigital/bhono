// src/server/routes/openapi.ts

export const openApiConfig = {
  openapi: '3.0.0',
  info: {
    title: 'Hono Boilerplate API',
    version: '1.0.0',
    description: 'Multi-tenant API with role-based access control. Uses session-based authentication via cookies. Login via /auth/login to start a session.',
  },
  servers: [
    { url: 'http://localhost:3000', description: 'Development server' },
  ],
  security: [{ SessionCookie: [] }],
} as const
