-- Disable RLS on student_ids table to allow registrar access
-- Run this directly in Supabase SQL Editor

-- Disable Row Level Security
ALTER TABLE student_ids DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies (optional, but clean)
DROP POLICY IF EXISTS "registrar can manage student IDs" ON student_ids;
DROP POLICY IF EXISTS "allow public read access for student ID validation" ON student_ids;
DROP POLICY IF EXISTS "allow authenticated users to read active student IDs" ON student_ids;
DROP POLICY IF EXISTS "Admin can manage all student IDs" ON student_ids;

-- Verify the table is accessible
SELECT * FROM student_ids LIMIT 1;
