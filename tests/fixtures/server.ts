// tests/fixtures/server.ts
import type { User, Account, SessionData } from '@server/types'
import type { Role } from '@server/auth/roles'

/**
 * Counter for generating unique IDs
 */
let idCounter = 0

/**
 * Generate a unique test ID
 */
function generateTestId(): string {
  idCounter++
  return `test-${idCounter}-${Date.now()}`
}

/**
 * Reset the ID counter (call in beforeEach if needed)
 */
export function resetIdCounter(): void {
  idCounter = 0
}

// ============================================================================
// USER FIXTURES
// ============================================================================

/**
 * Base user fixture with sensible defaults
 */
export interface UserFixtureOptions {
  id?: string
  email?: string
  name?: string
  avatarUrl?: string | null
  status?: 'active' | 'inactive'
  providerIds?: string[]
  isSuperAdmin?: boolean
  createdAt?: string
  updatedAt?: string
  deletedAt?: string | null
}

/**
 * Creates a standard user fixture
 */
export function createUserFixture(options: UserFixtureOptions = {}): User {
  const id = options.id ?? generateTestId()
  return {
    id,
    email: options.email ?? `user-${id}@example.com`,
    name: options.name ?? `Test User ${id}`,
    avatarUrl: options.avatarUrl ?? null,
    status: options.status ?? 'active',
    providerIds: options.providerIds ?? ['google'],
    isSuperAdmin: options.isSuperAdmin ?? false,
    createdAt: options.createdAt ?? new Date().toISOString(),
    updatedAt: options.updatedAt ?? new Date().toISOString(),
    deletedAt: options.deletedAt ?? null,
  }
}

/**
 * Creates an admin user fixture (account-level admin, not super admin)
 */
export function createAdminFixture(options: UserFixtureOptions = {}): User {
  return createUserFixture({
    name: options.name ?? 'Admin User',
    ...options,
  })
}

/**
 * Creates a super admin user fixture
 */
export function createSuperAdminFixture(options: UserFixtureOptions = {}): User {
  return createUserFixture({
    name: options.name ?? 'Super Admin',
    isSuperAdmin: true,
    ...options,
  })
}

/**
 * Creates a deleted (soft-deleted) user fixture
 */
export function createDeletedUserFixture(options: UserFixtureOptions = {}): User {
  return createUserFixture({
    status: 'inactive',
    deletedAt: options.deletedAt ?? new Date().toISOString(),
    ...options,
  })
}

/**
 * Creates an inactive user fixture
 */
export function createInactiveUserFixture(options: UserFixtureOptions = {}): User {
  return createUserFixture({
    status: 'inactive',
    ...options,
  })
}

// ============================================================================
// ACCOUNT FIXTURES
// ============================================================================

/**
 * Account fixture options
 */
export interface AccountFixtureOptions {
  id?: string
  name?: string
  description?: string | null
  domain?: string | null
  createdAt?: string
  updatedAt?: string
  deletedAt?: string | null
}

/**
 * Creates a standard account fixture
 */
export function createAccountFixture(options: AccountFixtureOptions = {}): Account {
  const id = options.id ?? generateTestId()
  return {
    id,
    name: options.name ?? `Test Account ${id}`,
    description: options.description ?? 'A test account for unit tests',
    domain: options.domain ?? null,
    createdAt: options.createdAt ?? new Date().toISOString(),
    updatedAt: options.updatedAt ?? new Date().toISOString(),
    deletedAt: options.deletedAt ?? null,
  }
}

/**
 * Creates a deleted (soft-deleted) account fixture
 */
export function createDeletedAccountFixture(options: AccountFixtureOptions = {}): Account {
  return createAccountFixture({
    deletedAt: options.deletedAt ?? new Date().toISOString(),
    ...options,
  })
}

/**
 * Creates an account with a domain
 */
export function createAccountWithDomainFixture(
  domain: string,
  options: AccountFixtureOptions = {}
): Account {
  return createAccountFixture({
    domain,
    ...options,
  })
}

// ============================================================================
// USER-ACCOUNT RELATIONSHIP FIXTURES
// ============================================================================

/**
 * User-Account relationship fixture options
 */
export interface UserAccountFixtureOptions {
  userId: string
  accountId: string
  role?: Role
}

/**
 * Creates a user-account relationship
 */
export function createUserAccountFixture(options: UserAccountFixtureOptions): {
  userId: string
  accountId: string
  role: Role
} {
  return {
    userId: options.userId,
    accountId: options.accountId,
    role: options.role ?? 'VIEWER',
  }
}

// ============================================================================
// SESSION FIXTURES
// ============================================================================

/**
 * Session fixture options
 */
export interface SessionFixtureOptions {
  userId?: string
  email?: string
  name?: string
  avatarUrl?: string | null
  isSuperAdmin?: boolean
  fingerprint?: {
    ip?: string
    userAgent?: string
  }
}

/**
 * Creates a session data fixture
 */
export function createSessionFixture(options: SessionFixtureOptions = {}): SessionData {
  const userId = options.userId ?? generateTestId()
  return {
    userId,
    email: options.email ?? `session-user-${userId}@example.com`,
    name: options.name ?? `Session User ${userId}`,
    avatarUrl: options.avatarUrl ?? null,
    isSuperAdmin: options.isSuperAdmin ?? false,
    fingerprint: options.fingerprint ?? {
      ip: '127.0.0.1',
      userAgent: 'TestAgent/1.0',
    },
  }
}

/**
 * Creates a super admin session fixture
 */
export function createSuperAdminSessionFixture(options: SessionFixtureOptions = {}): SessionData {
  return createSessionFixture({
    name: options.name ?? 'Super Admin Session',
    isSuperAdmin: true,
    ...options,
  })
}

/**
 * Creates a session token
 */
export function createSessionToken(): string {
  // Generate a realistic-looking session token
  const bytes = new Uint8Array(32)
  for (let i = 0; i < 32; i++) {
    bytes[i] = Math.floor(Math.random() * 256)
  }
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}

// ============================================================================
// REQUEST BODY FIXTURES
// ============================================================================

/**
 * Valid create user request body
 */
export const validCreateUserBody = {
  email: 'newuser@example.com',
  name: 'New User',
  password: 'SecurePassword123!',
}

/**
 * Invalid email request body
 */
export const invalidEmailBody = {
  email: 'not-an-email',
  name: 'New User',
  password: 'SecurePassword123!',
}

/**
 * Invalid password request body (too short)
 */
export const invalidPasswordBody = {
  email: 'newuser@example.com',
  name: 'New User',
  password: '123',
}

/**
 * Missing required fields body
 */
export const missingFieldsBody = {
  email: 'newuser@example.com',
}

/**
 * Valid login request body
 */
export const validLoginBody = {
  email: 'user@example.com',
  password: 'SecurePassword123!',
}

/**
 * Valid account creation body
 */
export const validCreateAccountBody = {
  name: 'New Account',
  description: 'A new test account',
}

/**
 * Valid account update body
 */
export const validUpdateAccountBody = {
  name: 'Updated Account Name',
  description: 'Updated description',
}

/**
 * Valid user update body
 */
export const validUpdateUserBody = {
  name: 'Updated User Name',
  status: 'active' as const,
}

/**
 * Valid invitation body
 */
export const validInvitationBody = {
  email: 'invited@example.com',
  role: 'VIEWER' as Role,
}

// ============================================================================
// DATABASE RECORD FIXTURES (for mocking D1 responses)
// ============================================================================

/**
 * Creates a user database record (matching D1 schema)
 */
export function createUserRecord(options: UserFixtureOptions = {}): Record<string, unknown> {
  const user = createUserFixture(options)
  return {
    id: user.id,
    google_id: `google-${user.id}`,
    email: user.email,
    name: user.name,
    avatar_url: user.avatarUrl,
    status: user.status,
    provider_ids: JSON.stringify(user.providerIds),
    is_super_admin: user.isSuperAdmin ? 1 : 0,
    created_at: user.createdAt,
    updated_at: user.updatedAt,
    deleted_at: user.deletedAt,
    created_by_id: null,
    updated_by_id: null,
    deleted_by_id: null,
  }
}

/**
 * Creates an account database record (matching D1 schema)
 */
export function createAccountRecord(options: AccountFixtureOptions = {}): Record<string, unknown> {
  const account = createAccountFixture(options)
  return {
    id: account.id,
    name: account.name,
    description: account.description,
    domain: account.domain,
    created_at: account.createdAt,
    updated_at: account.updatedAt,
    deleted_at: account.deletedAt,
  }
}

/**
 * Creates a user-account database record (matching D1 schema)
 */
export function createUserAccountRecord(
  options: UserAccountFixtureOptions
): Record<string, unknown> {
  const ua = createUserAccountFixture(options)
  return {
    user_id: ua.userId,
    account_id: ua.accountId,
    role: ua.role,
  }
}

// ============================================================================
// BULK FIXTURE CREATORS
// ============================================================================

/**
 * Creates multiple user fixtures
 */
export function createMultipleUsers(count: number, options: UserFixtureOptions = {}): User[] {
  return Array.from({ length: count }, (_, i) =>
    createUserFixture({
      ...options,
      name: options.name ? `${options.name} ${i + 1}` : undefined,
    })
  )
}

/**
 * Creates multiple account fixtures
 */
export function createMultipleAccounts(
  count: number,
  options: AccountFixtureOptions = {}
): Account[] {
  return Array.from({ length: count }, (_, i) =>
    createAccountFixture({
      ...options,
      name: options.name ? `${options.name} ${i + 1}` : undefined,
    })
  )
}

// ============================================================================
// FIXTURE PRESETS
// ============================================================================

/**
 * Preset: A complete test scenario with users, accounts, and relationships
 */
export interface TestScenario {
  superAdmin: User
  admin: User
  regularUser: User
  viewerUser: User
  deletedUser: User
  account1: Account
  account2: Account
  deletedAccount: Account
}

/**
 * Creates a complete test scenario with all common entities
 */
export function createTestScenario(): TestScenario {
  const superAdmin = createSuperAdminFixture({ id: 'super-admin-1' })
  const admin = createAdminFixture({ id: 'admin-1' })
  const regularUser = createUserFixture({ id: 'user-1' })
  const viewerUser = createUserFixture({ id: 'viewer-1', name: 'Viewer User' })
  const deletedUser = createDeletedUserFixture({ id: 'deleted-user-1' })

  const account1 = createAccountFixture({ id: 'account-1', name: 'Primary Account' })
  const account2 = createAccountFixture({ id: 'account-2', name: 'Secondary Account' })
  const deletedAccount = createDeletedAccountFixture({ id: 'deleted-account-1' })

  return {
    superAdmin,
    admin,
    regularUser,
    viewerUser,
    deletedUser,
    account1,
    account2,
    deletedAccount,
  }
}
