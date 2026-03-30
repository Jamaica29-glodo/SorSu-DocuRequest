-- Fix Student ID Table RLS Policy for Registrar Access
-- This allows registrar users to manage student IDs instead of admin users

-- Drop existing admin-only policy
DROP POLICY IF EXISTS "Admin can manage all student IDs" ON student_ids;

-- Create policy for registrar access
CREATE POLICY "registrar can manage student IDs" ON student_ids FOR ALL USING (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'registrar')
);

-- Allow public read access for student ID validation (unauthenticated users)
CREATE POLICY "allow public read access for student ID validation" ON student_ids 
FOR SELECT USING (is_active = true);

-- Allow authenticated users to read active student IDs (for future features)
CREATE POLICY "allow authenticated users to read active student IDs" ON student_ids 
FOR SELECT USING (
  auth.role() = 'authenticated' AND is_active = true
);
