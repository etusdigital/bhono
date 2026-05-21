import { fileURLToPath, URL } from "node:url"
import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  // Vitest 4: Use cacheDir for faster subsequent runs
  cacheDir: "./node_modules/.vitest-cache",
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src/client", import.meta.url)),
      "@shared": fileURLToPath(new URL("./src/shared", import.meta.url)),
      "@server": fileURLToPath(new URL("./src/server", import.meta.url)),
      "@tests": fileURLToPath(new URL("./tests", import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: "node",
    // Vitest 4: Schema matching with Zod
    setupFiles: ["./src/test/vitest-zod-matcher.ts"],
    include: ["tests/unit/server/**/*.test.ts", "tests/unit/shared/**/*.test.ts"],
    exclude: [
      "**/node_modules/**",
      "**/.claude/**",
      "**/dist/**",
      "**/e2e/**",
      "**/src/client/**",
      "**/tests/unit/client/**",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      reportsDirectory: "./.test-output/coverage/unit-server",
      include: ["src/server/**/*.ts", "src/shared/**/*.ts"],
      exclude: [
        "**/*.test.ts",
        "**/__tests__/**",
        "**/types/**",
        "**/*.d.ts",
        // Entry points and config
        "src/server/index.ts",
        "src/server/env.ts",
        // Database setup (not business logic)
        "src/server/db/client.ts",
        "src/server/db/seed.ts",
        "src/server/db/records.ts",
        // Barrel exports (just re-exports, no logic)
        "src/server/services/index.ts",
        "src/server/middleware/index.ts",
        "src/shared/schemas/index.ts",
        // Utility/infrastructure with hard-to-test edge cases
        "src/server/lib/password.ts",
        "src/server/lib/audit.ts",
        "src/server/lib/audited-db.ts",
        "src/server/lib/tokens.ts",
        // API documentation and router config (not testable)
        "src/server/routes/api.ts",
        "src/server/routes/index.ts",
        // Dev-only endpoint (tested via E2E)
        "src/server/routes/auth/test-login.ts",
        // Integration test fixtures
        "src/server/__integration__/setup.ts",
        "src/server/__integration__/fixtures.ts",
        "src/server/__integration__/fixtures/**",
      ],
      thresholds: {
        // TEMPORARY — lowered from 85/80/85/85 by the @etus/auth migration.
        // The package now owns auth/users/accounts/invitations/audit, so 60+
        // legacy tests for deleted code were removed. The remaining live
        // features (storage, middlewares, shared schemas) still need tests
        // rewritten under the new context-var model — tracked as a follow-up
        // in docs/plans/2026-05-20-001-refactor-migrate-auth-etus-auth-impl-plan.md
        // ("Out of scope" section). Restore to 85/80/85/85 once those land.
        statements: 60,
        branches: 55,
        functions: 60,
        lines: 60,
      },
    },
  },
})
