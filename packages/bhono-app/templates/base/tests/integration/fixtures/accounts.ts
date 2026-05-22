/**
 * Account Fixtures for Integration Tests
 *
 * Provides factory functions for creating auth accounts and membership
 * relationships in the test database.
 */

import { getSqlite } from '../setup'

// ============================================================================
// TYPES
// ============================================================================

export type Role = 'admin' | 'member' | 'guest'

export interface CreateAccountOptions {
  id?: string
  name?: string
  slug?: string | null
  ownerId?: string
}

export interface CreatedAccount {
  id: string
  name: string
  slug: string | null
  ownerId: string
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

let accountCounter = 0

function generateAccountDefaults(): { id: string; name: string } {
  accountCounter++
  return {
    id: crypto.randomUUID(),
    name: `Test Account ${accountCounter}`,
  }
}

// ============================================================================
// FIXTURE FACTORIES
// ============================================================================

/**
 * Create an account in the database with defaults
 */
export async function createAccount(options: CreateAccountOptions = {}): Promise<CreatedAccount> {
  const db = getSqlite()
  const defaults = generateAccountDefaults()

  const account: CreatedAccount = {
    id: options.id ?? defaults.id,
    name: options.name ?? defaults.name,
    slug: options.slug ?? null,
    ownerId: options.ownerId ?? 'test-owner',
  }

  db.prepare(`
    INSERT INTO auth_accounts (id, name, slug, owner_id)
    VALUES (?, ?, ?, ?)
  `).run(account.id, account.name, account.slug, account.ownerId)

  return account
}

/**
 * Legacy alias kept for old fixture callers. auth_accounts has no soft-delete column.
 */
export async function createDeletedAccount(options: CreateAccountOptions = {}): Promise<CreatedAccount> {
  return createAccount(options)
}

/**
 * Add a user to an account with a specific role
 */
export async function addUserToAccount(
  userId: string,
  accountId: string,
  role: Role
): Promise<{ userId: string; accountId: string; role: Role }> {
  const db = getSqlite()

  db.prepare(`
    INSERT INTO auth_memberships (id, user_id, account_id, role, status)
    VALUES (?, ?, ?, ?, ?)
  `).run(crypto.randomUUID(), userId, accountId, role, 'active')

  return { userId, accountId, role }
}

/**
 * Get all accounts for a user
 */
export async function getUserAccounts(userId: string): Promise<{ accountId: string; role: Role }[]> {
  const db = getSqlite()
  const rows = db.prepare(`
    SELECT account_id, role FROM auth_memberships WHERE user_id = ?
  `).all(userId) as { account_id: string; role: Role }[]

  return rows.map((row) => ({
    accountId: row.account_id,
    role: row.role,
  }))
}

/**
 * Get all users for an account
 */
export async function getAccountUsers(accountId: string): Promise<{ userId: string; role: Role }[]> {
  const db = getSqlite()
  const rows = db.prepare(`
    SELECT user_id, role FROM auth_memberships WHERE account_id = ?
  `).all(accountId) as { user_id: string; role: Role }[]

  return rows.map((row) => ({
    userId: row.user_id,
    role: row.role,
  }))
}
