/**
 * User Fixtures for Integration Tests
 *
 * Provides factory functions for creating users in the test database
 * with various states (active, inactive, super admin, deleted).
 */

import { getSqlite, createSession } from '../setup'

// ============================================================================
// TYPES
// ============================================================================

export interface CreateUserOptions {
  id?: string
  googleId?: string
  email?: string
  name?: string
  avatarUrl?: string | null
  status?: 'active' | 'inactive'
  isSuperAdmin?: boolean
  deletedAt?: string | null
}

export interface CreatedUser {
  id: string
  googleId: string
  email: string
  name: string
  avatarUrl: string | null
  status: 'active' | 'inactive'
  isSuperAdmin: boolean
  deletedAt: string | null
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

let userCounter = 0

function generateUserDefaults(): { id: string; googleId: string; email: string; name: string } {
  userCounter++
  const id = crypto.randomUUID()
  return {
    id,
    googleId: `google_${id}`,
    email: `testuser${userCounter}@example.com`,
    name: `Test User ${userCounter}`,
  }
}

// ============================================================================
// FIXTURE FACTORIES
// ============================================================================

/**
 * Create a user in the database with defaults
 */
export async function createUser(options: CreateUserOptions = {}): Promise<CreatedUser> {
  const db = getSqlite()
  const defaults = generateUserDefaults()

  const user: CreatedUser = {
    id: options.id ?? defaults.id,
    googleId: options.googleId ?? defaults.googleId,
    email: options.email ?? defaults.email,
    name: options.name ?? defaults.name,
    avatarUrl: options.avatarUrl ?? null,
    status: options.status ?? 'active',
    isSuperAdmin: options.isSuperAdmin ?? false,
    deletedAt: options.deletedAt ?? null,
  }

  db.prepare(`
    INSERT INTO users (id, google_id, email, name, avatar_url, status, is_super_admin, provider_ids, deleted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    user.id,
    user.googleId,
    user.email,
    user.name,
    user.avatarUrl,
    user.status,
    user.isSuperAdmin ? 1 : 0,
    JSON.stringify(['google']),
    user.deletedAt
  )

  return user
}

/**
 * Create a super admin user
 */
export async function createSuperAdmin(options: CreateUserOptions = {}): Promise<CreatedUser> {
  return createUser({
    ...options,
    isSuperAdmin: true,
    name: options.name ?? 'Super Admin User',
  })
}

/**
 * Create an inactive user
 */
export async function createInactiveUser(options: CreateUserOptions = {}): Promise<CreatedUser> {
  return createUser({
    ...options,
    status: 'inactive',
  })
}

/**
 * Create a soft-deleted user
 */
export async function createDeletedUser(options: CreateUserOptions = {}): Promise<CreatedUser> {
  const deletedAt = options.deletedAt ?? new Date().toISOString()
  return createUser({
    ...options,
    deletedAt,
  })
}

/**
 * Create a session for a user and return session ID and headers
 */
export async function createUserSession(
  userId: string,
  sessionData?: {
    email?: string
    name?: string
    avatarUrl?: string | null
    isSuperAdmin?: boolean
  }
): Promise<{ sessionId: string; headers: Record<string, string> }> {
  const { sessionId } = await createSession(userId, sessionData)
  return {
    sessionId,
    headers: {
      Cookie: `sid=${sessionId}`,
    },
  }
}
