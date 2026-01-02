import { fileURLToPath, URL } from "node:url"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { cloudflare } from "@cloudflare/vite-plugin"
import { TanStackRouterVite } from "@tanstack/router-plugin/vite"
import tailwindcss from "@tailwindcss/vite"
import istanbul from "vite-plugin-istanbul"

const isE2ECoverage = process.env.E2E_COVERAGE === "true"

export default defineConfig({
  plugins: [
    tailwindcss(),
    TanStackRouterVite({
      target: "react",
      autoCodeSplitting: true,
      routesDirectory: "./src/client/routes",
      generatedRouteTree: "./src/client/routeTree.gen.ts",
    }),
    react(),
    cloudflare(),
    // Istanbul instrumentation for E2E coverage
    // Only add plugin when E2E_COVERAGE is true, then it instruments without additional env check
    ...(isE2ECoverage
      ? [
          istanbul({
            include: "src/client/**/*",
            exclude: ["node_modules", "**/*.test.*", "**/__tests__/**"],
            extension: [".ts", ".tsx"],
            requireEnv: false, // We already check E2E_COVERAGE above
            forceBuildInstrument: false, // Use transform mode for dev server
          }),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src/client", import.meta.url)),
      "@shared": fileURLToPath(new URL("./src/shared", import.meta.url)),
      "@server": fileURLToPath(new URL("./src/server", import.meta.url)),
    },
  },
  build: {
    target: "es2020",
  },
})
