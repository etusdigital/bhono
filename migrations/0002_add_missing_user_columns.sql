-- migrations/0002_add_missing_user_columns.sql
-- Add missing columns to users table that were added in schema but not in initial migration

ALTER TABLE users ADD COLUMN provider_ids TEXT DEFAULT '[]';
ALTER TABLE users ADD COLUMN created_by_id TEXT REFERENCES users(id);
ALTER TABLE users ADD COLUMN updated_by_id TEXT REFERENCES users(id);
ALTER TABLE users ADD COLUMN deleted_by_id TEXT REFERENCES users(id);

-- Add unique constraint on accounts.domain
CREATE UNIQUE INDEX IF NOT EXISTS accounts_domain_unique ON accounts(domain) WHERE domain IS NOT NULL;
