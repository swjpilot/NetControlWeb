-- Add flag columns to session_participants
ALTER TABLE session_participants ADD COLUMN IF NOT EXISTS flag_comment BOOLEAN DEFAULT FALSE;
ALTER TABLE session_participants ADD COLUMN IF NOT EXISTS flag_traffic BOOLEAN DEFAULT FALSE;
ALTER TABLE session_participants ADD COLUMN IF NOT EXISTS flag_echolink BOOLEAN DEFAULT FALSE;
ALTER TABLE session_participants ADD COLUMN IF NOT EXISTS flag_announcement BOOLEAN DEFAULT FALSE;
