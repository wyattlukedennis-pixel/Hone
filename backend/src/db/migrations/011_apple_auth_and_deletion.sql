-- Add Apple Sign In support: users can authenticate via Apple ID
ALTER TABLE users ADD COLUMN IF NOT EXISTS apple_id TEXT UNIQUE;

-- Allow password_hash to be nullable for Apple-only accounts
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Index for fast Apple ID lookups during login
CREATE INDEX IF NOT EXISTS idx_users_apple_id ON users(apple_id) WHERE apple_id IS NOT NULL;
