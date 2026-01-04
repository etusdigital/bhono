// src/server/db/seed.ts
//
// This script generates SQL statements for seeding the database.
// Run with: npm run db:seed
//
// The generated SQL can be executed via wrangler:
// pnpm db:seed:local

import { generateStrongPassword } from '../lib/password'

// Helper to generate UUIDs
function uuid(): string {
  return crypto.randomUUID()
}

// Helper to get current timestamp
function now(): string {
  return new Date().toISOString()
}

// Helper to get expiry date (7 days from now)
function expiryDate(): string {
  const date = new Date()
  date.setDate(date.getDate() + 7)
  return date.toISOString()
}

// Helper to generate invitation token
function generateToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return [...array]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// ============================================================================
// SEED DATA
// ============================================================================

// Accounts
const accountIds = {
  default: uuid(),
  acme: uuid(),
  startup: uuid(),
}

const accountsData = [
  { id: accountIds.default, name: 'Default Account', domain: 'default.local', description: 'Default testing account' },
  { id: accountIds.acme, name: 'Acme Corporation', domain: 'acme.local', description: 'Enterprise client' },
  { id: accountIds.startup, name: 'Tech Startup', domain: 'startup.local', description: 'Small team account' },
]

// Users
const userIds = {
  superadmin: uuid(),
  admin: uuid(),
  manager: uuid(),
  editor: uuid(),
  author: uuid(),
  viewer: uuid(),
  billing: uuid(),
  analytics: uuid(),
  user1: uuid(),
  user2: uuid(),
}

const usersData = [
  { id: userIds.superadmin, email: 'superadmin@example.com', name: 'Super Admin', googleId: 'google-seed-superadmin-001', isSuperAdmin: true },
  { id: userIds.admin, email: 'admin@example.com', name: 'Admin User', googleId: 'google-seed-admin-002', isSuperAdmin: false },
  { id: userIds.manager, email: 'manager@example.com', name: 'Manager User', googleId: 'google-seed-manager-003', isSuperAdmin: false },
  { id: userIds.editor, email: 'editor@example.com', name: 'Editor User', googleId: 'google-seed-editor-004', isSuperAdmin: false },
  { id: userIds.author, email: 'author@example.com', name: 'Author User', googleId: 'google-seed-author-005', isSuperAdmin: false },
  { id: userIds.viewer, email: 'viewer@example.com', name: 'Viewer User', googleId: 'google-seed-viewer-006', isSuperAdmin: false },
  { id: userIds.billing, email: 'billing@example.com', name: 'Billing User', googleId: 'google-seed-billing-007', isSuperAdmin: false },
  { id: userIds.analytics, email: 'analytics@example.com', name: 'Analytics User', googleId: 'google-seed-analytics-008', isSuperAdmin: false },
  { id: userIds.user1, email: 'user1@example.com', name: 'Test User 1', googleId: 'google-seed-user1-009', isSuperAdmin: false },
  { id: userIds.user2, email: 'user2@example.com', name: 'Test User 2', googleId: 'google-seed-user2-010', isSuperAdmin: false },
]

// User-Account relationships
const userAccountsData = [
  // Default Account
  { userId: userIds.superadmin, accountId: accountIds.default, role: 'ADMIN' },
  { userId: userIds.admin, accountId: accountIds.default, role: 'ADMIN' },
  { userId: userIds.manager, accountId: accountIds.default, role: 'MANAGER' },
  { userId: userIds.editor, accountId: accountIds.default, role: 'EDITOR' },
  { userId: userIds.viewer, accountId: accountIds.default, role: 'VIEWER' },
  { userId: userIds.user1, accountId: accountIds.default, role: 'AUTHOR' },
  // Acme Corporation
  { userId: userIds.admin, accountId: accountIds.acme, role: 'ADMIN' },
  { userId: userIds.author, accountId: accountIds.acme, role: 'AUTHOR' },
  { userId: userIds.billing, accountId: accountIds.acme, role: 'BILLING' },
  { userId: userIds.user2, accountId: accountIds.acme, role: 'VIEWER' },
  // Tech Startup
  { userId: userIds.manager, accountId: accountIds.startup, role: 'MANAGER' },
  { userId: userIds.analytics, accountId: accountIds.startup, role: 'ANALYTICS' },
]

// Pending Invitations
const invitationsData = [
  { id: uuid(), accountId: accountIds.startup, email: 'invited1@example.com', role: 'EDITOR', token: generateToken(), invitedById: userIds.manager },
  { id: uuid(), accountId: accountIds.startup, email: 'invited2@example.com', role: 'AUTHOR', token: generateToken(), invitedById: userIds.manager },
  { id: uuid(), accountId: accountIds.acme, email: 'invited3@example.com', role: 'VIEWER', token: generateToken(), invitedById: userIds.admin },
]

// Audit Logs
const auditLogsData = [
  { id: uuid(), transactionId: uuid(), accountId: accountIds.default, userId: userIds.superadmin, entity: 'User', entityId: userIds.superadmin, action: 'SIGNUP', changes: { email: 'superadmin@example.com', provider: 'google' } },
  { id: uuid(), transactionId: uuid(), accountId: accountIds.default, userId: userIds.admin, entity: 'User', entityId: userIds.admin, action: 'SIGNUP', changes: { email: 'admin@example.com', provider: 'google' } },
  { id: uuid(), transactionId: uuid(), accountId: accountIds.default, userId: userIds.superadmin, entity: 'User', entityId: userIds.superadmin, action: 'LOGIN', changes: { email: 'superadmin@example.com' } },
  { id: uuid(), transactionId: uuid(), accountId: accountIds.default, userId: userIds.admin, entity: 'User', entityId: userIds.admin, action: 'LOGIN', changes: { email: 'admin@example.com' } },
  { id: uuid(), transactionId: uuid(), accountId: accountIds.acme, userId: userIds.admin, entity: 'Account', entityId: accountIds.acme, action: 'UPDATE', changes: { name: { old: 'Acme Inc', new: 'Acme Corporation' } } },
  { id: uuid(), transactionId: uuid(), accountId: accountIds.default, userId: userIds.manager, entity: 'User', entityId: userIds.viewer, action: 'UPDATE', changes: { status: { old: 'inactive', new: 'active' } } },
  { id: uuid(), transactionId: uuid(), accountId: accountIds.startup, userId: userIds.manager, entity: 'Invitation', entityId: 'inv-001', action: 'INSERT', changes: { email: 'invited1@example.com', role: 'EDITOR' } },
  { id: uuid(), transactionId: uuid(), accountId: accountIds.default, userId: userIds.editor, entity: 'User', entityId: userIds.editor, action: 'LOGIN', changes: {} },
  { id: uuid(), transactionId: uuid(), accountId: null, userId: null, entity: 'User', entityId: 'unknown', action: 'LOGIN_FAILED', changes: { email: 'hacker@evil.com', reason: 'Invalid credentials' } },
  { id: uuid(), transactionId: uuid(), accountId: accountIds.acme, userId: userIds.billing, entity: 'User', entityId: userIds.billing, action: 'LOGIN', changes: { email: 'billing@example.com' } },
]

// ============================================================================
// SQL GENERATION
// ============================================================================

function escapeString(str: string): string {
  return str.replaceAll('\'', "''")
}

function toSqlValue(value: unknown): string {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'boolean') return value ? '1' : '0'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return `'${escapeString(value)}'`
  if (typeof value === 'object') return `'${escapeString(JSON.stringify(value))}'`
  if (typeof value === 'bigint') return String(value)
  if (typeof value === 'symbol') return `'${escapeString(value.toString())}'`
  // function type - should not occur in seed data
  return 'NULL'
}

function generateSQL(): string {
  const timestamp = now()
  const expiry = expiryDate()
  const lines: string[] = []

  lines.push('-- ============================================================================')
  lines.push('-- SEED DATA - Generated by seed.ts')
  lines.push(`-- Generated at: ${timestamp}`)
  lines.push('-- ============================================================================')
  lines.push('')
  lines.push('-- Clear existing data (optional - comment out if you want to keep existing data)')
  lines.push('DELETE FROM audit_logs;')
  lines.push('DELETE FROM invitations;')
  lines.push('DELETE FROM user_accounts;')
  lines.push('DELETE FROM users;')
  lines.push('DELETE FROM accounts;')
  lines.push('')

  // Accounts
  lines.push('-- Accounts')
  for (const account of accountsData) {
    lines.push(`INSERT INTO accounts (id, name, domain, description, created_at, updated_at) VALUES (${toSqlValue(account.id)}, ${toSqlValue(account.name)}, ${toSqlValue(account.domain)}, ${toSqlValue(account.description)}, ${toSqlValue(timestamp)}, ${toSqlValue(timestamp)});`)
  }
  lines.push('')

  // Users
  lines.push('-- Users')
  for (const user of usersData) {
    lines.push(`INSERT INTO users (id, email, name, google_id, is_super_admin, status, created_at, updated_at) VALUES (${toSqlValue(user.id)}, ${toSqlValue(user.email)}, ${toSqlValue(user.name)}, ${toSqlValue(user.googleId)}, ${toSqlValue(user.isSuperAdmin)}, 'active', ${toSqlValue(timestamp)}, ${toSqlValue(timestamp)});`)
  }
  lines.push('')

  // User-Accounts
  lines.push('-- User-Account Relationships')
  for (const ua of userAccountsData) {
    lines.push(`INSERT INTO user_accounts (user_id, account_id, role) VALUES (${toSqlValue(ua.userId)}, ${toSqlValue(ua.accountId)}, ${toSqlValue(ua.role)});`)
  }
  lines.push('')

  // Invitations
  lines.push('-- Pending Invitations')
  for (const inv of invitationsData) {
    lines.push(`INSERT INTO invitations (id, account_id, email, role, token, invited_by_id, expires_at, created_at) VALUES (${toSqlValue(inv.id)}, ${toSqlValue(inv.accountId)}, ${toSqlValue(inv.email)}, ${toSqlValue(inv.role)}, ${toSqlValue(inv.token)}, ${toSqlValue(inv.invitedById)}, ${toSqlValue(expiry)}, ${toSqlValue(timestamp)});`)
  }
  lines.push('')

  // Audit Logs
  lines.push('-- Audit Logs')
  for (const log of auditLogsData) {
    lines.push(`INSERT INTO audit_logs (id, transaction_id, account_id, user_id, entity, entity_id, action, changes, timestamp) VALUES (${toSqlValue(log.id)}, ${toSqlValue(log.transactionId)}, ${toSqlValue(log.accountId)}, ${toSqlValue(log.userId)}, ${toSqlValue(log.entity)}, ${toSqlValue(log.entityId)}, ${toSqlValue(log.action)}, ${toSqlValue(log.changes)}, ${toSqlValue(timestamp)});`)
  }
  lines.push('')

  lines.push('-- ============================================================================')
  lines.push('-- SEED COMPLETE')
  lines.push(`-- Created: ${String(accountsData.length)} accounts, ${String(usersData.length)} users, ${String(userAccountsData.length)} user-accounts, ${String(invitationsData.length)} invitations, ${String(auditLogsData.length)} audit logs`)
  lines.push('-- ============================================================================')

  return lines.join('\n')
}

// ============================================================================
// SUMMARY OUTPUT
// ============================================================================

function printSummary(): void {
  console.log('\n📦 Seed Data Summary')
  console.log('====================\n')

  console.log('📁 Accounts:')
  for (const account of accountsData) {
    console.log(`   • ${account.name} (${account.domain})`)
  }

  console.log('\n👤 Users:')
  for (const user of usersData) {
    console.log(`   • ${user.email} - ${user.name}${user.isSuperAdmin ? ' [SUPER ADMIN]' : ''}`)
  }

  console.log('\n🔗 User-Account Relationships:')
  const byAccount = new Map<string, string[]>()
  for (const ua of userAccountsData) {
    const accountName = accountsData.find(a => a.id === ua.accountId)?.name ?? 'Unknown'
    const userName = usersData.find(u => u.id === ua.userId)?.name ?? 'Unknown'
    if (!byAccount.has(accountName)) byAccount.set(accountName, [])
    byAccount.get(accountName)?.push(`${userName} (${ua.role})`)
  }
  for (const [account, users] of byAccount.entries()) {
    console.log(`   ${account}:`)
    for (const user of users) {
      console.log(`     • ${user}`)
    }
  }

  console.log('\n📨 Pending Invitations:')
  for (const inv of invitationsData) {
    const accountName = accountsData.find(a => a.id === inv.accountId)?.name ?? 'Unknown'
    console.log(`   • ${inv.email} → ${accountName} (${inv.role})`)
  }

  console.log(`\n📋 Audit Logs: ${String(auditLogsData.length)} entries`)

  console.log('\n🔐 Sample Strong Password:', generateStrongPassword())

  console.log('\n✅ Run the following command to seed the local database:')
  console.log('   pnpm db:seed:local')
  console.log('   # or: wrangler --config config/wrangler.json d1 execute <db-name> --local --file=seed.sql\n')
}

// ============================================================================
// MAIN
// ============================================================================

const sql = generateSQL()

// Write to file
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const outputPath = join(__dirname, '..', '..', '..', 'seed.sql')

writeFileSync(outputPath, sql)
console.log(`\n✅ Generated seed.sql at: ${outputPath}`)

printSummary()
