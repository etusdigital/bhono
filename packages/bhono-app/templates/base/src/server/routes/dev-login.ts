// Development-only test-login endpoint.
//
// Mounted at /auth/test-login. E2E and integration suites POST here to obtain
// a session without running the real OAuth flow. @etus/auth does not expose a
// public createSession helper, so this replicates the package internals
// (auth_* schema, the D1 auth_sessions row, the __Host-auth_sid cookie). Fragile
// by design - keep it aligned with @etus/auth. Never reachable outside
// localhost. v0.6.0+: sessions live in D1 (createSqlSessionStore), not KV.

import { Hono, type Context } from 'hono'
import { setCookie } from 'hono/cookie'
import type { HonoEnv } from '../types'
import { ACCOUNT_MEMBERSHIP_ROLES, ROLES, type Role } from '../auth/matrix'

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

const CREATE_AUTH_USERS = `CREATE TABLE IF NOT EXISTS auth_users (
  id TEXT PRIMARY KEY,
  gateway_user_id TEXT,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  picture TEXT,
  role TEXT NOT NULL DEFAULT 'guest',
  status TEXT NOT NULL DEFAULT 'pending',
  invited_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT
)`

const CREATE_AUTH_SESSIONS = `CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  ip TEXT,
  user_agent TEXT,
  last_active_at INTEGER,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
)`

const CREATE_AUTH_ACCOUNTS = `CREATE TABLE IF NOT EXISTS auth_accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  owner_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
)`

const CREATE_AUTH_MEMBERSHIPS = `CREATE TABLE IF NOT EXISTS auth_memberships (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'guest',
  status TEXT NOT NULL DEFAULT 'active',
  invited_by TEXT,
  invited_at TEXT,
  joined_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(account_id, user_id)
)`

// Loopback hosts that count as local development. Covers IPv4, IPv6 (with
// and without brackets, since URL.hostname strips them inconsistently across
// runtimes), and the hostname alias.
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

export const devLogin = new Hono<HonoEnv>()

function getClientIp(c: Context<HonoEnv>): string {
  return c.req.header('CF-Connecting-IP')
    ?? c.req.header('X-Real-IP')
    ?? c.req.header('X-Forwarded-For')?.split(',')[0]?.trim()
    ?? 'unknown'
}

function getClientUserAgent(c: Context<HonoEnv>): string {
  return c.req.header('User-Agent') ?? 'unknown'
}

function toMembershipRole(role: string): string {
  if (role === 'admin' || role === 'owner') return 'admin'
  if (role === 'member') return 'member'
  return ACCOUNT_MEMBERSHIP_ROLES[2]
}

function isRole(role: string): role is Role {
  return (ROLES as readonly string[]).includes(role)
}

async function ensureUserAccount(db: D1Database, userId: string, name: string, role: string): Promise<string> {
  const existing = await db
    .prepare('SELECT account_id FROM auth_memberships WHERE user_id = ? AND status = ? LIMIT 1')
    .bind(userId, 'active')
    .first<{ account_id: string }>()

  if (existing?.account_id) return existing.account_id

  const accountId = crypto.randomUUID()
  const membershipId = crypto.randomUUID()
  const nowIso = new Date().toISOString()

  await db
    .prepare(
      `INSERT INTO auth_accounts (id, name, slug, owner_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(accountId, `${name}'s Workspace`, `dev-${userId}`, userId, nowIso, nowIso)
    .run()

  await db
    .prepare(
      `INSERT INTO auth_memberships
       (id, account_id, user_id, role, status, invited_by, invited_at, joined_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(membershipId, accountId, userId, toMembershipRole(role), 'active', null, null, nowIso, nowIso)
    .run()

  return accountId
}

devLogin.post('/', async (c) => {
  // Hostname-based gate: only loopback hosts are dev. Any other host
  // (workers.dev, custom domain) returns 403. Robust against env var
  // misconfiguration.
  const host = new URL(c.req.url).hostname
  if (!LOCAL_HOSTS.has(host)) {
    return c.json({ error: { message: 'Not available outside localhost' } }, 403)
  }

  const db = c.env.DB
  if (!db) {
    return c.json({ error: { message: 'DB not configured' } }, 500)
  }

  const body = await c.req.json<{ email?: string; name?: string; role?: string }>()
  if (!body.email) {
    return c.json({ error: { message: 'email is required' } }, 400)
  }

  const email = body.email.toLowerCase()
  const name = body.name ?? 'E2E Test User'
  const role = body.role ?? 'admin'
  if (!isRole(role)) {
    return c.json({ error: { message: `invalid role: ${role}` } }, 400)
  }
  const nowIso = new Date().toISOString()

  // Ensure the package-managed tables exist (the package's ensureSchema is
  // not exported; test-login may run before any package middleware does).
  await db.prepare(CREATE_AUTH_USERS).run()
  await db.prepare(CREATE_AUTH_SESSIONS).run()
  await db.prepare(CREATE_AUTH_ACCOUNTS).run()
  await db.prepare(CREATE_AUTH_MEMBERSHIPS).run()

  // Upsert the user in auth_users
  const existing = await db
    .prepare('SELECT id FROM auth_users WHERE email = ?')
    .bind(email)
    .first<{ id: string }>()

  let userId: string
  if (existing) {
    userId = existing.id
    await db
      .prepare('UPDATE auth_users SET status = ?, role = ?, name = ?, last_login_at = ? WHERE id = ?')
      .bind('active', role, name, nowIso, userId)
      .run()
  } else {
    userId = crypto.randomUUID()
    await db
      .prepare(
        `INSERT INTO auth_users
         (id, gateway_user_id, email, name, picture, role, status, invited_by, created_at, last_login_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(userId, null, email, name, null, role, 'active', null, nowIso, nowIso)
      .run()
  }

  const accountId = await ensureUserAccount(db, userId, name, role)

  // Create the session — the D1 auth_sessions row IS what @etus/auth's
  // createSqlSessionStore (v0.6.0+) reads; no KV mirror anymore.
  const sessionId = crypto.randomUUID()
  const nowMs = Date.now()
  const expiresAt = nowMs + SESSION_TTL_MS
  const fingerprint = {
    ip: getClientIp(c),
    userAgent: getClientUserAgent(c),
  }
  await db
    .prepare(
      `INSERT INTO auth_sessions (id, user_id, ip, user_agent, last_active_at, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(sessionId, userId, fingerprint.ip, fingerprint.userAgent, nowMs, expiresAt, nowMs)
    .run()

  // Set the session cookie (__Host- prefix on HTTPS, per getSessionCookieName)
  const isSecure = new URL(c.req.url).protocol === 'https:'
  setCookie(c, isSecure ? '__Host-auth_sid' : 'auth_sid', sessionId, {
    path: '/',
    httpOnly: true,
    secure: isSecure,
    sameSite: 'Lax',
    maxAge: SESSION_TTL_MS / 1000,
  })

  return c.json({ user: { id: userId, email, name, role }, accountId }, 200)
})
