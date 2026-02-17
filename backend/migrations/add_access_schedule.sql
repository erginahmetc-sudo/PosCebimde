-- Add access_schedule column to user_profiles table
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS access_schedule JSONB DEFAULT NULL;

-- Comment on column
COMMENT ON COLUMN user_profiles.access_schedule IS 'Stores the allowed access times for the user (e.g., { "Monday": { "start": "09:00", "end": "18:00" } })';
