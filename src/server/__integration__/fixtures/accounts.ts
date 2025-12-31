/**
 * Account Fixtures for Integration Tests
 *
 * Provides factory functions for creating accounts and user-account
 * relationships in the test database.
 */

import { getSqlite } from '../setup'

// ============================================================================
// TYPES
// ============================================================================

export type Role = 'ADMIN' | 'MANAGER' | 'EDITOR' | 'AUTHOR' | 'VIEWER' | 'BILLING' | 'ANALYTICS'

export interface CreateAccountOptions {
  id?: string
  name?: string
  description?: string | null
  domain?: string | null
  deletedAt?: string | null
}

export interface CreatedAccount {
  id: string
  name: string
  description: string | null
  domain: string | null
  deletedAt: string | null
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
    description: options.description ?? null,
    domain: options.domain ?? null,
    deletedAt: options.deletedAt ?? null,
  }

  db.prepare(`
    INSERT INTO accounts (id, name, description, domain, deleted_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    account.id,
    account.name,
    account.description,
    account.domain,
    account.deletedAt
  )

  return account
}

/**
 * Create a soft-deleted account
 */
export async function createDeletedAccount(options: CreateAccountOptions = {}): Promise<CreatedAccount> {
  const deletedAt = options.deletedAt ?? new Date().toISOString()
  return createAccount({
    ...options,
    deletedAt,
  })
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
    INSERT INTO user_accounts (user_id, account_id, role)
    VALUES (?, ?, ?)
  `).run(userId, accountId, role)

  return { userId, accountId, role }
}

/**
 * Get all accounts for a user
 */
export async function getUserAccounts(userId: string): Promise<Array<{ accountId: string; role: Role }>> {
  const db = getSqlite()
  const rows = db.prepare(`
    SELECT account_id, role FROM user_accounts WHERE user_id = ?
  `).all(userId) as Array<{ account_id: string; role: Role }>

  return rows.map((row) => ({
    accountId: row.account_id,
    role: row.role,
  }))
}

/**
 * Get all users for an account
 */
export async function getAccountUsers(accountId: string): Promise<Array<{ userId: string; role: Role }>> {
  const db = getSqlite()
  const rows = db.prepare(`
    SELECT user_id, role FROM user_accounts WHERE account_id = ?
  `).all(accountId) as Array<{ user_id: string; role: Role }>

  return rows.map((row) => ({
    userId: row.user_id,
    role: row.role,
  }))
}
