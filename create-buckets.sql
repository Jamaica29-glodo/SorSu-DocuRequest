-- Create the missing storage buckets for identity verification

-- First, let's get the authenticated role UUID
-- The authenticated role UUID is typically '00000000-0000-0000-0000-000000000000' in Supabase

-- Create identity-verifications bucket
INSERT INTO storage.buckets (id, name, owner, created_at, updated_at, file_size_limit, allowed_mime_types)
VALUES (
  'identity-verifications',
  'identity-verifications',
  '00000000-0000-0000-0000-000000000000', -- authenticated role UUID
  NOW(),
  NOW(),
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'application/pdf']
) ON CONFLICT (id) DO NOTHING;

-- Create documents bucket (fallback)
INSERT INTO storage.buckets (id, name, owner, created_at, updated_at, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  '00000000-0000-0000-0000-000000000000', -- authenticated role UUID
  NOW(),
  NOW(),
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
) ON CONFLICT (id) DO NOTHING;

-- Set up Row Level Security (RLS) for identity-verifications bucket
CREATE POLICY "Users can view their own identity verification files" ON storage.objects
FOR SELECT USING (
  auth.role() = 'authenticated' AND 
  auth.uid() = (storage.foldername(name))[1]::uuid
);

CREATE POLICY "Users can upload their own identity verification files" ON storage.objects
FOR INSERT WITH CHECK (
  auth.role() = 'authenticated' AND 
  auth.uid() = (storage.foldername(name))[1]::uuid
);

CREATE POLICY "Users can update their own identity verification files" ON storage.objects
FOR UPDATE USING (
  auth.role() = 'authenticated' AND 
  auth.uid() = (storage.foldername(name))[1]::uuid
);

CREATE POLICY "Users can delete their own identity verification files" ON storage.objects
FOR DELETE USING (
  auth.role() = 'authenticated' AND 
  auth.uid() = (storage.foldername(name))[1]::uuid
);

-- Set up Row Level Security (RLS) for documents bucket
CREATE POLICY "Users can view their own document files" ON storage.objects
FOR SELECT USING (
  auth.role() = 'authenticated' AND 
  auth.uid() = (storage.foldername(name))[1]::uuid
);

CREATE POLICY "Users can upload their own document files" ON storage.objects
FOR INSERT WITH CHECK (
  auth.role() = 'authenticated' AND 
  auth.uid() = (storage.foldername(name))[1]::uuid
);

CREATE POLICY "Users can update their own document files" ON storage.objects
FOR UPDATE USING (
  auth.role() = 'authenticated' AND 
  auth.uid() = (storage.foldername(name))[1]::uuid
);

CREATE POLICY "Users can delete their own document files" ON storage.objects
FOR DELETE USING (
  auth.role() = 'authenticated' AND 
  auth.uid() = (storage.foldername(name))[1]::uuid
);

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions
GRANT ALL ON SCHEMA storage TO anon, authenticated;
GRANT ALL ON storage.buckets TO anon, authenticated;
GRANT ALL ON storage.objects TO anon, authenticated;
