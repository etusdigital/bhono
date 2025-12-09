import { fileURLToPath, URL } from "node:url"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { cloudflare } from "@cloudflare/vite-plugin"
import { TanStackRouterVite } from "@tanstack/router-plugin/vite"
import tailwindcss from "@tailwindcss/vite"

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
