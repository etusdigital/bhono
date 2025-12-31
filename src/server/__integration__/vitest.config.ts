import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@server': fileURLToPath(new URL('../', import.meta.url)),
      '@shared': fileURLToPath(new URL('../../shared', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/server/__integration__/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/.claude/**', '**/dist/**'],
    setupFiles: ['src/server/__integration__/setup.ts'],
    // Use forks with singleFork for sequential execution
    // This ensures tests don't interfere with each other's database state
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    // Longer timeouts for integration tests
    testTimeout: 30000,
    hookTimeout: 30000,
    // Retry failed tests once (helpful for flaky integration tests)
    retry: 1,
  },
})
