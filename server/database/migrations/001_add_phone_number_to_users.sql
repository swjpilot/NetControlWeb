-- Migration: Add phone_number field to users table
-- Date: 2026-03-13

-- Check if column exists before adding
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='users' 
        AND column_name='phone_number'
    ) THEN
        ALTER TABLE users ADD COLUMN phone_number VARCHAR(20);
        RAISE NOTICE 'Column phone_number added to users table';
    ELSE
        RAISE NOTICE 'Column phone_number already exists in users table';
    END IF;
END $$;

COMMENT ON COLUMN users.phone_number IS 'User phone number for contact purposes';
