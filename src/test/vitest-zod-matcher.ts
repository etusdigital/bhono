// src/test/vitest-zod-matcher.ts
// Vitest 4: Schema matching with Zod
import { expect } from "vitest"
import type { z } from "zod"

interface ZodMatcherResult {
  pass: boolean
  message: () => string
  actual?: unknown
  expected?: unknown
}

expect.extend({
  toMatchSchema(received: unknown, schema: z.ZodType): ZodMatcherResult {
    const result = schema.safeParse(received)

    if (result.success) {
      return {
        pass: true,
        message: () => `Expected value NOT to match schema, but it did`,
        actual: received,
      }
    }

    const formattedErrors = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n")

    return {
      pass: false,
      message: () =>
        `Expected value to match schema, but validation failed:\n${formattedErrors}`,
      actual: received,
      expected: "Valid schema match",
    }
  },
})
