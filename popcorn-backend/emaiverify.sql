-- Email Verification Migration
-- Run this on your Supabase SQL editor

-- Add is_verified column (defaults to FALSE for new users)
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;

-- Add verification_token column
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token TEXT;

-- Set all existing users to verified (so they can still log in)
UPDATE users SET is_verified = TRUE WHERE is_verified IS NULL;
