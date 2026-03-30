-- Migration: Add preferred_name column to operators table
-- This allows operators to have a preferred first name displayed in sessions

ALTER TABLE operators ADD COLUMN IF NOT EXISTS preferred_name VARCHAR(100);

-- Add comment
COMMENT ON COLUMN operators.preferred_name IS 'Preferred first name for display in sessions';
