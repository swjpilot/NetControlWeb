-- Migration: Add force_password_change field to users table
-- Date: 2026-03-13

-- Check if column exists before adding
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='users' 
        AND column_name='force_password_change'
    ) THEN
        ALTER TABLE users ADD COLUMN force_password_change BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Column force_password_change added to users table';
    ELSE
        RAISE NOTICE 'Column force_password_change already exists in users table';
    END IF;
END $$;

COMMENT ON COLUMN users.force_password_change IS 'Flag to force user to change password on next login';
