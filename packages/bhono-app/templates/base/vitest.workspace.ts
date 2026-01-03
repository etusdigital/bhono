import { defineWorkspace } from 'vitest/config'

/**
 * Vitest Workspace for running all unit tests together
 * This enables unified coverage reporting for server, client, and shared code
 */
export default defineWorkspace([
  // Server and shared tests
  {
    extends: './vitest.config.ts',
    test: {
      name: 'server',
    },
  },
  // Client tests
  {
    extends: './vitest.config.frontend.ts',
    test: {
      name: 'client',
    },
  },
])
