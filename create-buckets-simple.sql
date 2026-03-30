-- Simple bucket creation without RLS policies
-- This should work with basic permissions

-- Create identity-verifications bucket
INSERT INTO storage.buckets (id, name, owner, public)
VALUES (
  'identity-verifications',
  'identity-verifications',
  '00000000-0000-0000-0000-000000000000',
  false
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  owner = EXCLUDED.owner,
  public = EXCLUDED.public;

-- Create documents bucket (fallback)
INSERT INTO storage.buckets (id, name, owner, public)
VALUES (
  'documents',
  'documents',
  '00000000-0000-0000-0000-000000000000',
  false
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  owner = EXCLUDED.owner,
  public = EXCLUDED.public;

-- Grant permissions
GRANT ALL ON storage.buckets TO authenticated, anon;
GRANT ALL ON storage.objects TO authenticated, anon;
