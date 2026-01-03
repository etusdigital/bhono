import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: '../src/server/db/schema/index.ts',
  out: '../src/server/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: '../.wrangler/state/v3/d1/miniflare-D1DatabaseObject/a9de77f83189-41d984dda38d3c9c27bd.sqlite',
  },
})
