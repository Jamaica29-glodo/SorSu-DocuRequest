-- Update Student IDs Table: Rename notes to student_name and add sample names
-- This script modifies the student_ids table to store student names

-- Step 1: Rename the notes column to student_name
ALTER TABLE student_ids RENAME COLUMN notes TO student_name;

-- Step 2: Update the sample data to include student names
UPDATE student_ids SET student_name = 'Juan dela Cruz' WHERE student_id = '2021001';
UPDATE student_ids SET student_name = 'Maria Santos' WHERE student_id = '2021002';
UPDATE student_ids SET student_name = 'Jose Reyes' WHERE student_id = '2021003';
UPDATE student_ids SET student_name = 'Ana Garcia' WHERE student_id = '2021004';
UPDATE student_ids SET student_name = 'Carlos Lopez' WHERE student_id = '2021005';

-- Step 3: Add a NOT NULL constraint (optional - uncomment if you want to enforce it)
-- ALTER TABLE student_ids ALTER COLUMN student_name SET NOT NULL;

-- Step 4: Update comments to reflect the change
COMMENT ON COLUMN student_ids.student_name IS 'Full name of the student associated with this Student ID';

-- Step 5: Update RLS policies if needed (they should still work as the column is just renamed)
