-- Add session_version column to user_profiles table for force logout functionality
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS session_version INTEGER DEFAULT 1;

-- Comment on column
COMMENT ON COLUMN user_profiles.session_version IS 'Incremented to invalid old sessions. If DB version > Local version, user is logged out.';
