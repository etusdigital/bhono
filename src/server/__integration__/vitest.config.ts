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
      ],
    },
  },
})
