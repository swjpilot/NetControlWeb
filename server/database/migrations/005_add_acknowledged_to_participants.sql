-- Add acknowledged column to session_participants
ALTER TABLE session_participants ADD COLUMN IF NOT EXISTS acknowledged BOOLEAN DEFAULT FALSE;
