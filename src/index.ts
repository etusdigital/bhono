import { serve } from '@hono/node-server'
import { createApp } from './app'
import { api } from './routes'
import { env } from './env'

const app = createApp()

// Mount API routes
app.route('/api', api)

// Health check endpoint (no auth required)
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

// Start server
const port = env.PORT
console.log(`🚀 Server starting on port ${port}`)
console.log(`📚 API docs available at http://localhost:${port}/api/swagger`)

serve({
  fetch: app.fetch,
  port,
})
