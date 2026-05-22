-- schema.sql
-- Source of truth for the D1 (SQLite) schema.
-- Apply locally:
--   pnpm db:schema:local
-- Apply remotely:
--   pnpm db:schema:remote
--
-- Auth, users, accounts, memberships, invitations, sessions and audit logs
-- are owned by @etus/auth. Keep this schema aligned with the installed
-- package plus this product's role catalog: owner, admin, member, guest.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS auth_users (
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
);

CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth_users(email);
CREATE INDEX IF NOT EXISTS idx_auth_users_gateway_id ON auth_users(gateway_user_id);
CREATE INDEX IF NOT EXISTS idx_auth_users_status ON auth_users(status);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  ip TEXT,
  user_agent TEXT,
  last_active_at INTEGER,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires ON auth_sessions(expires_at);

CREATE TABLE IF NOT EXISTS auth_audit_logs (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  actor_id TEXT,
  actor_email TEXT,
  target_id TEXT,
  target_type TEXT,
  account_id TEXT,
  ip TEXT,
  user_agent TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_actor ON auth_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_event ON auth_audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_account ON auth_audit_logs(account_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON auth_audit_logs(created_at);

CREATE TABLE IF NOT EXISTS auth_accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  owner_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_accounts_owner ON auth_accounts(owner_id);
CREATE INDEX IF NOT EXISTS idx_accounts_slug ON auth_accounts(slug);

CREATE TABLE IF NOT EXISTS auth_memberships (
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
);

CREATE INDEX IF NOT EXISTS idx_memberships_account ON auth_memberships(account_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON auth_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_status ON auth_memberships(status);

CREATE TABLE IF NOT EXISTS auth_invitations (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'guest',
  invited_by TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_invitations_account ON auth_invitations(account_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON auth_invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON auth_invitations(token);

CREATE TABLE IF NOT EXISTS auth_user_permissions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  permission TEXT NOT NULL,
  account_id TEXT,
  granted_by TEXT,
  expires_at INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_perms_unique
  ON auth_user_permissions(user_id, permission, COALESCE(account_id, '__global__'));
CREATE INDEX IF NOT EXISTS idx_user_perms_user ON auth_user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_perms_account ON auth_user_permissions(account_id);
CREATE INDEX IF NOT EXISTS idx_user_perms_expires ON auth_user_permissions(expires_at);

CREATE TABLE IF NOT EXISTS auth_resource_permissions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  permission TEXT NOT NULL,
  account_id TEXT,
  granted_by TEXT,
  expires_at INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_res_perms_unique
  ON auth_resource_permissions(
    user_id,
    resource_type,
    resource_id,
    permission,
    COALESCE(account_id, '__global__')
  );
CREATE INDEX IF NOT EXISTS idx_res_perms_user ON auth_resource_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_res_perms_resource ON auth_resource_permissions(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_res_perms_lookup
  ON auth_resource_permissions(user_id, resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_res_perms_account ON auth_resource_permissions(account_id);
