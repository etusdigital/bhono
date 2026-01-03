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
    },
  },
  test: {
    globals: true,
    environment: "node",
    // Vitest 4: Schema matching with Zod
    setupFiles: ["./src/test/vitest-zod-matcher.ts"],
    include: ["src/server/**/*.test.ts", "src/shared/**/*.test.ts"],
    exclude: [
      "**/node_modules/**",
      "**/.claude/**",
      "**/dist/**",
      "**/e2e/**",
      "**/src/client/**",
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
        // Barrel exports (just re-exports, no logic)
        "src/server/db/schema/index.ts",
        "src/server/services/index.ts",
        "src/server/middleware/index.ts",
        "src/shared/schemas/index.ts",
        // Drizzle schema definitions (table structures, not business logic)
        "src/server/db/schema/users.ts",
        "src/server/db/schema/accounts.ts",
        "src/server/db/schema/user-accounts.ts",
        "src/server/db/schema/audit-logs.ts",
        "src/server/db/schema/refresh-tokens.ts",
        "src/server/db/schema/invitations.ts",
        // Utility/infrastructure with hard-to-test edge cases
        "src/server/lib/password.ts",
        "src/server/lib/audit.ts",
        "src/server/lib/audited-db.ts",
        "src/server/lib/tokens.ts",
        // API documentation and router config (not testable)
        "src/server/routes/api.ts",
        "src/server/routes/index.ts",
        // Simple utilities (low value to test)
        "src/server/lib/schema-helpers.ts",
        // Dev-only endpoint (tested via E2E)
        "src/server/routes/auth/test-login.ts",
        // Integration test fixtures
        "src/server/__integration__/setup.ts",
        "src/server/__integration__/fixtures.ts",
        "src/server/__integration__/fixtures/**",
      ],
      thresholds: {
        statements: 90,
        branches: 84, // Handlers have hard-to-test error branches
        functions: 85,
        lines: 90,
      },
    },
  },
})
