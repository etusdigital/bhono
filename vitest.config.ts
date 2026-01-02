import { fileURLToPath, URL } from "node:url"
import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
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
    // Vitest 4: File-system cache for faster subsequent runs
    cache: {
      dir: "./node_modules/.vitest-cache",
    },
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
      reportsDirectory: "./coverage/server",
      include: ["src/server/**/*.ts", "src/shared/**/*.ts"],
      exclude: [
        "**/*.test.ts",
        "**/__tests__/**",
        "**/types/**",
        "**/*.d.ts",
        "src/server/index.ts",
        "src/server/db/client.ts",
        "src/server/db/seed.ts",
        "src/server/db/schema-helpers.ts",
        "src/server/routes/api.ts",
        "src/server/__integration__/setup.ts",
        "src/server/__integration__/fixtures.ts",
      ],
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 85,
        lines: 90,
      },
    },
  },
})
