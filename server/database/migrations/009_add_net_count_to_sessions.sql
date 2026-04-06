-- Add net_count field to sessions for tracking how many times the NC has called the net
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS net_count INTEGER DEFAULT 0;
