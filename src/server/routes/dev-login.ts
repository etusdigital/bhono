// Development-only test-login endpoint.
//
// Mounted at /auth/test-login when ENVIRONMENT !== 'production'. E2E and
// integration suites POST here to obtain a session without running the real
// OAuth flow. @etus/auth does not expose a public createSession helper, so
// this replicates the package internals (auth_users / auth_sessions schema,
// the auth_sid: KV key, the __Host-auth_sid cookie). Fragile by design —
// see plan AC6. Never reachable in production.

import { Hono } from 'hono'
import { setCookie } from 'hono/cookie'
import type { HonoEnv } from '../types'

const SESSION_PREFIX = 'auth_sid:'
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

const CREATE_AUTH_USERS = `CREATE TABLE IF NOT EXISTS auth_users (
  id TEXT PRIMARY KEY,
  gateway_user_id TEXT,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  picture TEXT,
  role TEXT NOT NULL DEFAULT 'viewer',
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

// Loopback hosts that count as local development. Covers IPv4, IPv6 (with
// and without brackets, since URL.hostname strips them inconsistently across
// runtimes), and the hostname alias.
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

// The package-managed tables only need to be ensured once per isolate.
let schemaEnsured = false

export const devLogin = new Hono<HonoEnv>()

devLogin.post('/', async (c) => {
  // Hostname-based gate: only loopback hosts are dev. Any other host
  // (workers.dev, custom domain) returns 403. Robust against env var
  // misconfiguration.
  const host = new URL(c.req.url).hostname
  if (!LOCAL_HOSTS.has(host)) {
    return c.json({ error: { message: 'Not available outside localhost' } }, 403)
  }

  const db = c.env.DB
  const kv = c.env.SESSIONS
  if (!db || !kv) {
    return c.json({ error: { message: 'DB/KV not configured' } }, 500)
  }

  const body = await c.req.json<{ email?: string; name?: string; role?: string }>()
  if (!body.email) {
    return c.json({ error: { message: 'email is required' } }, 400)
  }

  const email = body.email.toLowerCase()
  const name = body.name ?? 'E2E Test User'
  const role = body.role ?? 'admin'
  const nowIso = new Date().toISOString()

  // Ensure the package-managed tables exist (the package's ensureSchema is
  // not exported; test-login may run before any package middleware does).
  // Memoized — runs at most once per isolate.
  if (!schemaEnsured) {
    await db.prepare(CREATE_AUTH_USERS).run()
    await db.prepare(CREATE_AUTH_SESSIONS).run()
    schemaEnsured = true
  }

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

  // Create the session — KV holds the shape @etus/auth's middleware reads
  const sessionId = crypto.randomUUID()
  const nowMs = Date.now()
  const expiresAt = nowMs + SESSION_TTL_MS
  await kv.put(
    `${SESSION_PREFIX}${sessionId}`,
    JSON.stringify({ id: sessionId, userId, expiresAt, createdAt: nowMs }),
    { expiration: Math.floor(expiresAt / 1000) },
  )
  await db
    .prepare(
      `INSERT INTO auth_sessions (id, user_id, ip, user_agent, last_active_at, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(sessionId, userId, null, null, nowMs, expiresAt, nowMs)
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

  return c.json({ user: { id: userId, email, name, role } }, 200)
})
