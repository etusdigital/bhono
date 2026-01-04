-- schema.sql
-- Source of truth for the D1 (SQLite) schema.
-- Apply locally:
--   wrangler --config config/wrangler.json d1 execute <db-name> --local --file=schema.sql
-- Apply remotely:
--   wrangler --config config/wrangler.json d1 execute <db-name> --remote --file=schema.sql

PRAGMA foreign_keys = ON;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  google_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  status TEXT DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'inactive')),
  provider_ids TEXT DEFAULT '[]',
  is_super_admin INTEGER DEFAULT 0 NOT NULL,
  created_at TEXT DEFAULT (datetime('now')) NOT NULL,
  updated_at TEXT DEFAULT (datetime('now')) NOT NULL,
  deleted_at TEXT,
  created_by_id TEXT REFERENCES users(id),
  updated_by_id TEXT REFERENCES users(id),
  deleted_by_id TEXT REFERENCES users(id)
);

-- Accounts table
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  domain TEXT UNIQUE,
  created_at TEXT DEFAULT (datetime('now')) NOT NULL,
  updated_at TEXT DEFAULT (datetime('now')) NOT NULL,
  deleted_at TEXT
);

-- User-Accounts junction table
CREATE TABLE IF NOT EXISTS user_accounts (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'MANAGER', 'EDITOR', 'AUTHOR', 'VIEWER', 'BILLING', 'ANALYTICS')),
  PRIMARY KEY (user_id, account_id)
);

-- Refresh tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
  revoked_at INTEGER
);

-- Invitations table
CREATE TABLE IF NOT EXISTS invitations (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'MANAGER', 'EDITOR', 'AUTHOR', 'VIEWER', 'BILLING', 'ANALYTICS')),
  token TEXT NOT NULL UNIQUE,
  invited_by_id TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  created_at TEXT DEFAULT (datetime('now')) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS account_email_idx ON invitations(account_id, email);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL,
  account_id TEXT REFERENCES accounts(id),
  user_id TEXT REFERENCES users(id),
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'SIGNUP', 'TOKEN_REFRESH', 'LOGIN_FAILED')),
  changes TEXT,
  ip_address TEXT,
  user_agent TEXT,
  timestamp TEXT DEFAULT (datetime('now')) NOT NULL
);
