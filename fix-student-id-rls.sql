-- Fix Student ID Table RLS Policy for Registration
-- This allows unauthenticated users to validate student IDs during registration

-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Admin can manage all student IDs" ON student_ids;

-- Create new policies for proper access control

-- Allow public read access for student ID validation (unauthenticated users)
CREATE POLICY "Allow public read access for student ID validation" ON student_ids 
FOR SELECT USING (is_active = true);

-- Allow admin full access to student IDs
CREATE POLICY "Admin can manage all student IDs" ON student_ids 
FOR ALL USING (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- Allow authenticated users to read active student IDs (for future features)
CREATE POLICY "Allow authenticated users to read active student IDs" ON student_ids 
FOR SELECT USING (
  auth.role() = 'authenticated' AND is_active = true
);
