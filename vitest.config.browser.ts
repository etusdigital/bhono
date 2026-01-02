// vitest.config.browser.ts
// Vitest 4: Browser Mode for frontend tests with real browser execution
import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import { fileURLToPath, URL } from "node:url"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src/client", import.meta.url)),
      "@shared": fileURLToPath(new URL("./src/shared", import.meta.url)),
    },
  },
  test: {
    globals: true,
    // Vitest 4: Browser Mode with Playwright
    browser: {
      enabled: true,
      provider: "playwright",
      instances: [{ browser: "chromium" }],
      headless: true,
    },
    // Vitest 4: File-system cache
    cache: {
      dir: "./node_modules/.vitest-cache",
    },
    // Vitest 4: Schema matching with Zod
    setupFiles: [
      "./src/test/vitest-zod-matcher.ts",
      "./src/client/__tests__/setup-browser.ts",
    ],
    include: ["src/client/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".claude", "dist"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      reportsDirectory: "./coverage/client-browser",
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
