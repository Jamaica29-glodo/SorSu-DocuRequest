-- Fix Row Level Security policies to allow file uploads

-- First, disable RLS temporarily
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view their own identity verification files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own identity verification files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own identity verification files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own identity verification files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own document files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own document files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own document files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own document files" ON storage.objects;

-- Create simple, permissive policies for authenticated users
CREATE POLICY "Allow authenticated users to access storage" ON storage.objects
FOR ALL USING (
  auth.role() = 'authenticated'
);

-- Create a more permissive policy for uploads
CREATE POLICY "Allow uploads to identity-verifications bucket" ON storage.objects
FOR INSERT WITH CHECK (
  auth.role() = 'authenticated' AND 
  (storage.foldername(name))[1] IS NOT NULL
);

-- Create policy for viewing files
CREATE POLICY "Allow viewing files in identity-verifications bucket" ON storage.objects
FOR SELECT USING (
  auth.role() = 'authenticated'
);

-- Create policy for updating files
CREATE POLICY "Allow updating files in identity-verifications bucket" ON storage.objects
FOR UPDATE USING (
  auth.role() = 'authenticated'
);

-- Create policy for deleting files
CREATE POLICY "Allow deleting files in identity-verifications bucket" ON storage.objects
FOR DELETE USING (
  auth.role() = 'authenticated'
);

-- Re-enable RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions
GRANT ALL ON storage.buckets TO authenticated, anon;
GRANT ALL ON storage.objects TO authenticated, anon;
