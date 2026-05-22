import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

const projectRoot = fileURLToPath(new URL('../..', import.meta.url))

export default defineConfig({
  // Vitest 4: Use cacheDir for faster subsequent runs
  cacheDir: `${projectRoot}/node_modules/.vitest-cache`,
  resolve: {
    alias: {
      '@server': `${projectRoot}/src/server`,
      '@shared': `${projectRoot}/src/shared`,
      '@tests': `${projectRoot}/tests`,
    },
  },
  test: {
    globals: true,
    environment: 'node',
    root: projectRoot,
    // Vitest 4: Schema matching with Zod
    setupFiles: [
      `${projectRoot}/src/test/vitest-zod-matcher.ts`,
      `${projectRoot}/tests/integration/setup.ts`,
    ],
    include: ['tests/integration/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/.claude/**', '**/dist/**'],
    // Use forks for sequential execution
    // This ensures tests don't interfere with each other's database state
    pool: 'forks',
    singleFork: true,
    // Longer timeouts for integration tests
    testTimeout: 30000,
    hookTimeout: 30000,
    // Retry failed tests once (helpful for flaky integration tests)
    retry: 1,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: `${projectRoot}/.test-output/coverage/integration`,
      include: ['src/server/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        '**/__tests__/**',
        '**/__integration__/**',
        '**/types/**',
        '**/*.d.ts',
        // Entry points and config
        'src/server/index.ts',
        'src/server/env.ts',
        // Database setup (not business logic)
        'src/server/db/client.ts',
        'src/server/db/seed.ts',
        'src/server/db/records.ts',
        // Barrel exports (just re-exports, no logic)
        'src/server/services/index.ts',
        'src/server/middleware/index.ts',
        // API documentation (not testable)
        'src/server/routes/api.ts',
        // Dev-only endpoint (tested via E2E)
        'src/server/routes/auth/test-login.ts',
        // Hard to test in isolation (require external services/mocking)
        'src/server/lib/providers.ts',
        'src/server/lib/transaction.ts',
      ],
      // Integration coverage is diagnostic: this suite validates wiring,
      // D1/KV/R2 behavior, and cross-module contracts. Unit suites own the
      // global coverage gates.
    },
  },
})
