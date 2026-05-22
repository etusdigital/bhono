/**
 * User Fixtures for Integration Tests
 *
 * Provides factory functions for creating @etus/auth users in the test
 * database with various states.
 */

import { getSqlite, createSession } from '../setup'

// ============================================================================
// TYPES
// ============================================================================

export interface CreateUserOptions {
  id?: string
  gatewayUserId?: string | null
  email?: string
  name?: string
  picture?: string | null
  role?: 'owner' | 'admin' | 'member' | 'guest'
  status?: 'pending' | 'active' | 'suspended' | 'denied'
  isSuperAdmin?: boolean
}

export interface CreatedUser {
  id: string
  gatewayUserId: string | null
  email: string
  name: string
  picture: string | null
  role: 'owner' | 'admin' | 'member' | 'guest'
  status: 'pending' | 'active' | 'suspended' | 'denied'
  isSuperAdmin: boolean
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

let userCounter = 0

function generateUserDefaults(): { id: string; gatewayUserId: string; email: string; name: string } {
  userCounter++
  const id = crypto.randomUUID()
  return {
    id,
    gatewayUserId: `gateway_${id}`,
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
  const role = options.role ?? (options.isSuperAdmin ? 'admin' : 'member')

  const user: CreatedUser = {
    id: options.id ?? defaults.id,
    gatewayUserId: options.gatewayUserId ?? defaults.gatewayUserId,
    email: options.email ?? defaults.email,
    name: options.name ?? defaults.name,
    picture: options.picture ?? null,
    role,
    status: options.status ?? 'active',
    isSuperAdmin: options.isSuperAdmin ?? (role === 'owner' || role === 'admin'),
  }

  db.prepare(`
    INSERT INTO auth_users (id, gateway_user_id, email, name, picture, role, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    user.id,
    user.gatewayUserId,
    user.email,
    user.name,
    user.picture,
    user.role,
    user.status,
  )

  return user
}

/**
 * Create a super admin user
 */
export async function createSuperAdmin(options: CreateUserOptions = {}): Promise<CreatedUser> {
  return createUser({
    ...options,
    role: options.role ?? 'admin',
    isSuperAdmin: true,
    name: options.name ?? 'Super Admin User',
  })
}

/**
 * Create a suspended user.
 */
export async function createInactiveUser(options: CreateUserOptions = {}): Promise<CreatedUser> {
  return createUser({
    ...options,
    status: 'suspended',
  })
}

/**
 * Create a denied user. Kept as a legacy alias for older integration helpers.
 */
export async function createDeletedUser(options: CreateUserOptions = {}): Promise<CreatedUser> {
  return createUser({
    ...options,
    status: 'denied',
  })
}

/**
 * Create a session for a user and return session ID and headers
 */
export async function createUserSession(
  userId: string,
  _sessionData?: {
    email?: string
    name?: string
    picture?: string | null
    isSuperAdmin?: boolean
  }
): Promise<{ sessionId: string; headers: Record<string, string> }> {
  const { sessionId } = await createSession(userId)
  return {
    sessionId,
    headers: {
      Cookie: `auth_sid=${sessionId}`,
    },
  }
}
