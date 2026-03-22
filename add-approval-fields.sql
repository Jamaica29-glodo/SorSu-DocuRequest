-- Add approval fields to profiles table
-- This adds the necessary fields for the two-step approval system

-- Add approval-related columns to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS approval_reason TEXT,
ADD COLUMN IF NOT EXISTS ban_reason TEXT,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS banned_at TIMESTAMP WITH TIME ZONE;

-- Update existing profiles to have default approval status
UPDATE profiles 
SET is_approved = FALSE 
WHERE is_approved IS NULL;

-- Create index for approval queries
CREATE INDEX IF NOT EXISTS idx_profiles_is_approved ON profiles(is_approved);
CREATE INDEX IF NOT EXISTS idx_profiles_is_banned ON profiles(is_banned);

-- Add comment
COMMENT ON COLUMN profiles.is_approved IS 'Whether the student registration has been approved by admin';
COMMENT ON COLUMN profiles.is_banned IS 'Whether the student account has been banned';
COMMENT ON COLUMN profiles.approval_reason IS 'Reason for approving the student registration';
COMMENT ON COLUMN profiles.ban_reason IS 'Reason for banning the student account';
COMMENT ON COLUMN profiles.approved_at IS 'Timestamp when the student was approved';
COMMENT ON COLUMN profiles.banned_at IS 'Timestamp when the student was banned';
