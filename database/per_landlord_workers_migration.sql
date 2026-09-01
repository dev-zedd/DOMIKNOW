-- Migration: Scope maintenance workers per landlord
-- Adds created_by_landlord_id to users table so each maintenance
-- worker is owned by the landlord who registered them.

ALTER TABLE users
ADD COLUMN IF NOT EXISTS created_by_landlord_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Index for fast per-landlord worker lookups
CREATE INDEX IF NOT EXISTS idx_users_created_by_landlord
    ON users (created_by_landlord_id)
    WHERE role = 'maintenance';

-- Backfill: parse existing "Created by Landlord #<uuid>" address values
-- Only runs when the address column matches that pattern and the UUID exists.
UPDATE users AS w
SET created_by_landlord_id = (
    REGEXP_MATCH(w.address, 'Created by Landlord #([0-9a-f\-]{36})')
)[1]::UUID
WHERE w.role = 'maintenance'
  AND w.address ~ 'Created by Landlord #[0-9a-f\-]{36}'
  AND EXISTS (
      SELECT 1 FROM users l
      WHERE l.id = (
          REGEXP_MATCH(w.address, 'Created by Landlord #([0-9a-f\-]{36})')
      )[1]::UUID
  );
