// vitest.config.browser.ts
// Vitest 4: Browser Mode for frontend tests with real browser execution
import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import { fileURLToPath, URL } from "node:url"
import { playwright } from "@vitest/browser-playwright"

export default defineConfig({
  plugins: [react()],
  // Vitest 4: Use cacheDir instead of cache.dir
  cacheDir: "./node_modules/.vitest-cache",
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src/client", import.meta.url)),
      "@shared": fileURLToPath(new URL("./src/shared", import.meta.url)),
      "@tests": fileURLToPath(new URL("./tests", import.meta.url)),
    },
  },
  test: {
    globals: true,
    // Vitest 4: Browser Mode with Playwright (new factory API)
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
      headless: true,
    },
    // Vitest 4: Schema matching with Zod
    setupFiles: [
      "./src/test/vitest-zod-matcher.ts",
      "./tests/helpers/client-setup-browser.ts",
    ],
    include: ["tests/unit/client/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".claude", "dist"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      reportsDirectory: "./.test-output/coverage/client-browser",
      include: ["src/client/**/*.{ts,tsx}"],
      exclude: [
        "**/*.test.{ts,tsx}",
        "**/__tests__/**",
        "**/routeTree.gen.ts",
        "**/*.d.ts",
      ],
    },
  },
})
