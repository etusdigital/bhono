/**
 * Integration Test Fixtures
 *
 * Re-exports all fixture factories and provides composite scenario builders
 * for creating complex test setups.
 */

// Re-export all fixture factories
export * from './users'
export * from './accounts'
export * from './invitations'

// Import for internal use
import { createUser, createSuperAdmin, createUserSession, type CreatedUser } from './users'
import { createAccount, addUserToAccount, type CreatedAccount, type Role } from './accounts'

// ============================================================================
// TYPES
// ============================================================================

export interface TestScenarioOptions {
  userName?: string
  userEmail?: string
  isSuperAdmin?: boolean
  accountName?: string
  role?: Role
}

export interface TestScenarioResult {
  user: CreatedUser
  account: CreatedAccount
  sessionId: string
  headers: Record<string, string>
}

export interface MultiUserScenarioResult {
  account: CreatedAccount
  admin: {
    user: CreatedUser
    sessionId: string
    headers: Record<string, string>
  }
  member: {
    user: CreatedUser
    sessionId: string
    headers: Record<string, string>
  }
  guest: {
    user: CreatedUser
    sessionId: string
    headers: Record<string, string>
  }
}

export interface MultiTenantScenarioResult {
  user: CreatedUser
  sessionId: string
  headers: Record<string, string>
  accounts: {
    withAccess: { account: CreatedAccount; role: Role }[]
    withoutAccess: CreatedAccount[]
  }
}

// ============================================================================
// COMPOSITE SCENARIO BUILDERS
// ============================================================================

/**
 * Create a complete test scenario with user, account, membership, and session
 *
 * This is the most common setup for integration tests - a user who is
 * a member of an account and has an active session.
 */
export async function createTestScenario(
  options: TestScenarioOptions = {}
): Promise<TestScenarioResult> {
  // Create user
  const user = options.isSuperAdmin
    ? await createSuperAdmin({
        name: options.userName,
        email: options.userEmail,
      })
    : await createUser({
        name: options.userName,
        email: options.userEmail,
      })

  // Create account
  const account = await createAccount({
    name: options.accountName,
  })

  // Add user to account
  await addUserToAccount(user.id, account.id, options.role ?? 'admin')

  // Create session
  const { sessionId, headers } = await createUserSession(user.id, {
    email: user.email,
    name: user.name,
  })

  return {
    user,
    account,
    sessionId,
    headers,
  }
}

/**
 * Create a multi-user scenario with admin, member, and guest in one account.
 *
 * Useful for testing role-based access control across different permission levels.
 */
export async function createMultiUserScenario(): Promise<MultiUserScenarioResult> {
  // Create account
  const account = await createAccount({
    name: 'Multi-User Test Account',
  })

  // Create admin user
  const adminUser = await createUser({
    name: 'Admin User',
    email: 'admin@example.com',
  })
  await addUserToAccount(adminUser.id, account.id, 'admin')
  const adminSession = await createUserSession(adminUser.id, {
    email: adminUser.email,
    name: adminUser.name,
  })

  // Create member user
  const memberUser = await createUser({
    name: 'Member User',
    email: 'member@example.com',
  })
  await addUserToAccount(memberUser.id, account.id, 'member')
  const memberSession = await createUserSession(memberUser.id, {
    email: memberUser.email,
    name: memberUser.name,
  })

  // Create guest user
  const guestUser = await createUser({
    name: 'Guest User',
    email: 'guest@example.com',
  })
  await addUserToAccount(guestUser.id, account.id, 'guest')
  const guestSession = await createUserSession(guestUser.id, {
    email: guestUser.email,
    name: guestUser.name,
  })

  return {
    account,
    admin: {
      user: adminUser,
      sessionId: adminSession.sessionId,
      headers: adminSession.headers,
    },
    member: {
      user: memberUser,
      sessionId: memberSession.sessionId,
      headers: memberSession.headers,
    },
    guest: {
      user: guestUser,
      sessionId: guestSession.sessionId,
      headers: guestSession.headers,
    },
  }
}

/**
 * Create a multi-tenant scenario with a user who has access to some accounts but not others
 *
 * Useful for testing tenant isolation and cross-account access control.
 */
export async function createMultiTenantScenario(): Promise<MultiTenantScenarioResult> {
  // Create user
  const user = await createUser({
    name: 'Multi-Tenant User',
    email: 'multitenant@example.com',
  })

  // Create accounts with access (different roles)
  const accountWithAdminAccess = await createAccount({
    name: 'Account With Admin Access',
  })
  await addUserToAccount(user.id, accountWithAdminAccess.id, 'admin')

  const accountWithMemberAccess = await createAccount({
    name: 'Account With Member Access',
  })
  await addUserToAccount(user.id, accountWithMemberAccess.id, 'member')

  const accountWithGuestAccess = await createAccount({
    name: 'Account With Guest Access',
  })
  await addUserToAccount(user.id, accountWithGuestAccess.id, 'guest')

  // Create accounts without access
  const accountWithoutAccess1 = await createAccount({
    name: 'Account Without Access 1',
  })

  const accountWithoutAccess2 = await createAccount({
    name: 'Account Without Access 2',
  })

  // Create session
  const { sessionId, headers } = await createUserSession(user.id, {
    email: user.email,
    name: user.name,
  })

  return {
    user,
    sessionId,
    headers,
    accounts: {
      withAccess: [
        { account: accountWithAdminAccess, role: 'admin' as Role },
        { account: accountWithMemberAccess, role: 'member' as Role },
        { account: accountWithGuestAccess, role: 'guest' as Role },
      ],
      withoutAccess: [accountWithoutAccess1, accountWithoutAccess2],
    },
  }
}
