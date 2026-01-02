// src/client/__tests__/setup-browser.ts
// Setup file for Vitest Browser Mode (real browser, no mocks needed)
import "@testing-library/jest-dom/vitest"
import "../../test/vitest-zod-matcher"
import { cleanup } from "@testing-library/react"
import { afterEach, vi } from "vitest"

// Cleanup after each test
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

// Note: No mocks for matchMedia or ResizeObserver needed
// Browser Mode runs in a real browser where these APIs exist natively
