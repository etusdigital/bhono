import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import { fileURLToPath, URL } from "node:url"

export default defineConfig({
  plugins: [react()],
  // Vitest 4: Use cacheDir for faster subsequent runs
  cacheDir: "./node_modules/.vitest-cache",
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src/client", import.meta.url)),
      "@shared": fileURLToPath(new URL("./src/shared", import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/client/__tests__/setup.ts"],
    include: ["src/client/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".claude", "dist"],
    // Increase timeout for route tests that have async loading
    testTimeout: 15000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      reportsDirectory: "./.test-output/coverage/unit-client",
      include: ["src/client/**/*.{ts,tsx}"],
      exclude: [
        "**/*.test.{ts,tsx}",
        "**/__tests__/**",
        "**/*.d.ts",
        // Generated files
        "**/routeTree.gen.ts",
        // Entry points (bootstrap code, not testable in isolation)
        "src/client/main.tsx",
        "src/client/router.ts",
      ],
      thresholds: {
        // TODO: Increase to 85% after adding tests for route components
        statements: 65,
        branches: 70,
        functions: 58,
        lines: 67,
      },
    },
  },
})
