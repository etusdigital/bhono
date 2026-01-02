// src/test/vitest.d.ts
// Type declarations for custom Vitest matchers
import "vitest"
import type { z } from "zod"

declare module "vitest" {
  interface Assertion<T = unknown> {
    /**
     * Asserts that the value matches the given Zod schema.
     * @example
     * expect(user).toMatchSchema(z.object({ id: z.uuid(), email: z.email() }))
     */
    toMatchSchema(schema: z.ZodType): T
  }

  interface AsymmetricMatchersContaining {
    toMatchSchema(schema: z.ZodType): unknown
  }
}
