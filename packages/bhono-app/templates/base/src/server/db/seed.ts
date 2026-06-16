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
  // Scenario-aligned users (emails match src/server/dev/gateway-scenario.ts so the
  // same accounts carry gateway per-account roles when ETUS_GATEWAY_MOCK is on).
  multi: uuid(),
  pending: uuid(),
  suspended: uuid(),
}

// Accounts
const accountIds = {
  default: uuid(),
  acme: uuid(),
  startup: uuid(),
}

const accountsData = [
  { id: accountIds.default, name: 'Default Account', slug: 'default', ownerId: userIds.superadmin },
  { id: accountIds.acme, name: 'Acme Corporation', slug: 'acme', ownerId: userIds.admin },
  { id: accountIds.startup, name: 'Tech Startup', slug: 'startup', ownerId: userIds.manager },
]

// Users. `status` defaults to 'active' in the SQL below; set it explicitly to seed
// pending/suspended accounts for the team-management UI's status states.
const usersData: {
  id: string
  email: string
  name: string
  gatewayUserId: string
  role: string
  status?: 'active' | 'pending' | 'suspended' | 'denied'
}[] = [
  { id: userIds.superadmin, email: 'superadmin@example.com', name: 'Super Admin', gatewayUserId: 'gateway-seed-superadmin-001', role: 'owner' },
  { id: userIds.admin, email: 'admin@example.com', name: 'Admin User', gatewayUserId: 'gateway-seed-admin-002', role: 'admin' },
  { id: userIds.manager, email: 'manager@example.com', name: 'Manager User', gatewayUserId: 'gateway-seed-manager-003', role: 'admin' },
  { id: userIds.editor, email: 'editor@example.com', name: 'Editor User', gatewayUserId: 'gateway-seed-editor-004', role: 'member' },
  { id: userIds.author, email: 'author@example.com', name: 'Author User', gatewayUserId: 'gateway-seed-author-005', role: 'member' },
  { id: userIds.viewer, email: 'viewer@example.com', name: 'Viewer User', gatewayUserId: 'gateway-seed-viewer-006', role: 'guest' },
  { id: userIds.billing, email: 'billing@example.com', name: 'Billing User', gatewayUserId: 'gateway-seed-billing-007', role: 'member' },
  { id: userIds.analytics, email: 'analytics@example.com', name: 'Analytics User', gatewayUserId: 'gateway-seed-analytics-008', role: 'member' },
  { id: userIds.user1, email: 'user1@example.com', name: 'Test User 1', gatewayUserId: 'gateway-seed-user1-009', role: 'guest' },
  { id: userIds.user2, email: 'user2@example.com', name: 'Test User 2', gatewayUserId: 'gateway-seed-user2-010', role: 'guest' },
  // Multi-workspace user: at the gateway, admin on Initech + viewer on Acme (the
  // cross-account over-grant case the conservative ACCOUNT_ROLE_MAP guards).
  { id: userIds.multi, email: 'multi@example.com', name: 'Multi Workspace', gatewayUserId: 'gateway-seed-multi-011', role: 'member' },
  // Status states for the team-management UI.
  { id: userIds.pending, email: 'pending@example.com', name: 'Pending User', gatewayUserId: 'gateway-seed-pending-012', role: 'guest', status: 'pending' },
  { id: userIds.suspended, email: 'suspended@example.com', name: 'Suspended User', gatewayUserId: 'gateway-seed-suspended-013', role: 'member', status: 'suspended' },
]

// Account memberships. @etus/auth account routes currently use membership role
// "admin" for workspace administration; global owner/admin still live on
// auth_users.role and the product RBAC matrix.
const membershipsData = [
  // Default Account
  { id: uuid(), userId: userIds.superadmin, accountId: accountIds.default, role: 'admin' },
  { id: uuid(), userId: userIds.admin, accountId: accountIds.default, role: 'admin' },
  { id: uuid(), userId: userIds.manager, accountId: accountIds.default, role: 'admin' },
  { id: uuid(), userId: userIds.editor, accountId: accountIds.default, role: 'member' },
  { id: uuid(), userId: userIds.viewer, accountId: accountIds.default, role: 'guest' },
  { id: uuid(), userId: userIds.user1, accountId: accountIds.default, role: 'guest' },
  // Acme Corporation
  { id: uuid(), userId: userIds.admin, accountId: accountIds.acme, role: 'admin' },
  { id: uuid(), userId: userIds.author, accountId: accountIds.acme, role: 'member' },
  { id: uuid(), userId: userIds.billing, accountId: accountIds.acme, role: 'member' },
  { id: uuid(), userId: userIds.user2, accountId: accountIds.acme, role: 'guest' },
  { id: uuid(), userId: userIds.multi, accountId: accountIds.acme, role: 'member' },
  { id: uuid(), userId: userIds.suspended, accountId: accountIds.acme, role: 'member' },
  // Tech Startup
  { id: uuid(), userId: userIds.manager, accountId: accountIds.startup, role: 'admin' },
  { id: uuid(), userId: userIds.analytics, accountId: accountIds.startup, role: 'member' },
]

// Pending Invitations
const invitationsData = [
  { id: uuid(), accountId: accountIds.startup, email: 'invited1@example.com', role: 'member', token: generateToken(), invitedById: userIds.manager },
  { id: uuid(), accountId: accountIds.startup, email: 'invited2@example.com', role: 'member', token: generateToken(), invitedById: userIds.manager },
  { id: uuid(), accountId: accountIds.acme, email: 'invited3@example.com', role: 'guest', token: generateToken(), invitedById: userIds.admin },
]

// Audit Logs
const auditLogsData = [
  { id: uuid(), eventType: 'user.created', actorId: userIds.superadmin, actorEmail: 'superadmin@example.com', targetId: userIds.superadmin, targetType: 'user', accountId: accountIds.default, metadata: { email: 'superadmin@example.com', provider: 'etus-gateway' } },
  { id: uuid(), eventType: 'user.created', actorId: userIds.admin, actorEmail: 'admin@example.com', targetId: userIds.admin, targetType: 'user', accountId: accountIds.default, metadata: { email: 'admin@example.com', provider: 'etus-gateway' } },
  { id: uuid(), eventType: 'auth.login', actorId: userIds.superadmin, actorEmail: 'superadmin@example.com', targetId: userIds.superadmin, targetType: 'user', accountId: accountIds.default, metadata: { email: 'superadmin@example.com' } },
  { id: uuid(), eventType: 'auth.login', actorId: userIds.admin, actorEmail: 'admin@example.com', targetId: userIds.admin, targetType: 'user', accountId: accountIds.default, metadata: { email: 'admin@example.com' } },
  { id: uuid(), eventType: 'account.updated', actorId: userIds.admin, actorEmail: 'admin@example.com', targetId: accountIds.acme, targetType: 'account', accountId: accountIds.acme, metadata: { name: { old: 'Acme Inc', new: 'Acme Corporation' } } },
  { id: uuid(), eventType: 'user.updated', actorId: userIds.manager, actorEmail: 'manager@example.com', targetId: userIds.viewer, targetType: 'user', accountId: accountIds.default, metadata: { status: { old: 'pending', new: 'active' } } },
  { id: uuid(), eventType: 'account.invitation_sent', actorId: userIds.manager, actorEmail: 'manager@example.com', targetId: invitationsData[0].id, targetType: 'invitation', accountId: accountIds.startup, metadata: { email: 'invited1@example.com', role: 'member' } },
  { id: uuid(), eventType: 'auth.login', actorId: userIds.editor, actorEmail: 'editor@example.com', targetId: userIds.editor, targetType: 'user', accountId: accountIds.default, metadata: {} },
  { id: uuid(), eventType: 'auth.login_failed', actorId: null, actorEmail: 'hacker@evil.com', targetId: 'unknown', targetType: 'user', accountId: null, metadata: { email: 'hacker@evil.com', reason: 'Gateway rejected credentials' } },
  { id: uuid(), eventType: 'auth.login', actorId: userIds.billing, actorEmail: 'billing@example.com', targetId: userIds.billing, targetType: 'user', accountId: accountIds.acme, metadata: { email: 'billing@example.com' } },
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
  lines.push('DELETE FROM auth_resource_permissions;')
  lines.push('DELETE FROM auth_user_permissions;')
  lines.push('DELETE FROM auth_audit_logs;')
  lines.push('DELETE FROM auth_invitations;')
  lines.push('DELETE FROM auth_memberships;')
  lines.push('DELETE FROM auth_sessions;')
  lines.push('DELETE FROM auth_accounts;')
  lines.push('DELETE FROM auth_users;')
  lines.push('')

  // Users
  lines.push('-- Users')
  for (const user of usersData) {
    lines.push(`INSERT INTO auth_users (id, gateway_user_id, email, name, picture, role, status, invited_by, created_at, last_login_at) VALUES (${toSqlValue(user.id)}, ${toSqlValue(user.gatewayUserId)}, ${toSqlValue(user.email)}, ${toSqlValue(user.name)}, NULL, ${toSqlValue(user.role)}, ${toSqlValue(user.status ?? 'active')}, NULL, ${toSqlValue(timestamp)}, ${toSqlValue(timestamp)});`)
  }
  lines.push('')

  // Accounts
  lines.push('-- Accounts')
  for (const account of accountsData) {
    lines.push(`INSERT INTO auth_accounts (id, name, slug, owner_id, created_at, updated_at) VALUES (${toSqlValue(account.id)}, ${toSqlValue(account.name)}, ${toSqlValue(account.slug)}, ${toSqlValue(account.ownerId)}, ${toSqlValue(timestamp)}, ${toSqlValue(timestamp)});`)
  }
  lines.push('')

  // Memberships
  lines.push('-- Account Memberships')
  for (const membership of membershipsData) {
    lines.push(`INSERT INTO auth_memberships (id, account_id, user_id, role, status, invited_by, invited_at, joined_at, created_at) VALUES (${toSqlValue(membership.id)}, ${toSqlValue(membership.accountId)}, ${toSqlValue(membership.userId)}, ${toSqlValue(membership.role)}, 'active', NULL, NULL, ${toSqlValue(timestamp)}, ${toSqlValue(timestamp)});`)
  }
  lines.push('')

  // Invitations
  lines.push('-- Pending Invitations')
  for (const inv of invitationsData) {
    lines.push(`INSERT INTO auth_invitations (id, account_id, email, role, invited_by, token, expires_at, accepted_at, created_at) VALUES (${toSqlValue(inv.id)}, ${toSqlValue(inv.accountId)}, ${toSqlValue(inv.email)}, ${toSqlValue(inv.role)}, ${toSqlValue(inv.invitedById)}, ${toSqlValue(inv.token)}, ${toSqlValue(expiry)}, NULL, ${toSqlValue(timestamp)});`)
  }
  lines.push('')

  // Audit Logs
  lines.push('-- Audit Logs')
  for (const log of auditLogsData) {
    lines.push(`INSERT INTO auth_audit_logs (id, event_type, actor_id, actor_email, target_id, target_type, account_id, ip, user_agent, metadata, created_at) VALUES (${toSqlValue(log.id)}, ${toSqlValue(log.eventType)}, ${toSqlValue(log.actorId)}, ${toSqlValue(log.actorEmail)}, ${toSqlValue(log.targetId)}, ${toSqlValue(log.targetType)}, ${toSqlValue(log.accountId)}, NULL, NULL, ${toSqlValue(log.metadata)}, ${toSqlValue(timestamp)});`)
  }
  lines.push('')

  lines.push('-- ============================================================================')
  lines.push('-- SEED COMPLETE')
  lines.push(`-- Created: ${String(accountsData.length)} accounts, ${String(usersData.length)} users, ${String(membershipsData.length)} memberships, ${String(invitationsData.length)} invitations, ${String(auditLogsData.length)} audit logs`)
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
    console.log(`   • ${account.name} (${account.slug})`)
  }

  console.log('\n👤 Users:')
  for (const user of usersData) {
    const status = user.status && user.status !== 'active' ? `, ${user.status}` : ''
    console.log(`   • ${user.email} - ${user.name} (${user.role}${status})`)
  }

  console.log('\n🔗 Account Memberships:')
  const byAccount = new Map<string, string[]>()
  for (const membership of membershipsData) {
    const accountName = accountsData.find(a => a.id === membership.accountId)?.name ?? 'Unknown'
    const userName = usersData.find(u => u.id === membership.userId)?.name ?? 'Unknown'
    if (!byAccount.has(accountName)) byAccount.set(accountName, [])
    byAccount.get(accountName)?.push(`${userName} (${membership.role})`)
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

  console.log('💡 To see GATEWAY per-account roles (viewer/editor/manager/admin) in the UI,')
  console.log('   set ETUS_GATEWAY_MOCK=1 in .dev.vars, then log in via /auth/test-login as a')
  console.log('   scenario user (e.g. multi@example.com — admin on Initech + viewer on Acme).')
  console.log('   See src/server/dev/gateway-scenario.ts.\n')
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
