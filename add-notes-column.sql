-- Add notes column to student_ids table
-- This column is used by the registrar dashboard for student names

ALTER TABLE student_ids ADD COLUMN IF NOT EXISTS notes text;

-- Update the table to show the new column
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'student_ids' 
ORDER BY ordinal_position;
