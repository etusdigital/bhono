import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Vitest 4: Use cacheDir for faster subsequent runs
  cacheDir: './node_modules/.vitest-cache',
  resolve: {
    alias: {
      '@server': fileURLToPath(new URL('../', import.meta.url)),
      '@shared': fileURLToPath(new URL('../../shared', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    // Vitest 4: Schema matching with Zod
    setupFiles: [
      'src/test/vitest-zod-matcher.ts',
      'src/server/__integration__/setup.ts',
    ],
    include: ['src/server/__integration__/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/.claude/**', '**/dist/**'],
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
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage/integration',
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
        // Barrel exports (just re-exports, no logic)
        'src/server/db/schema/index.ts',
        'src/server/services/index.ts',
        'src/server/middleware/index.ts',
        // Drizzle schema definitions (table structures, not business logic)
        'src/server/db/schema/users.ts',
        'src/server/db/schema/accounts.ts',
        'src/server/db/schema/user-accounts.ts',
        'src/server/db/schema/audit-logs.ts',
        'src/server/db/schema/refresh-tokens.ts',
        'src/server/db/schema/invitations.ts',
        // API documentation (not testable)
        'src/server/routes/api.ts',
        // Dev-only endpoint (tested via E2E)
        'src/server/routes/auth/test-login.ts',
        // Hard to test in isolation (require external services/mocking)
        'src/server/lib/providers.ts',
        'src/server/lib/transaction.ts',
        'src/server/lib/schema-helpers.ts',
      ],
    },
  },
})
