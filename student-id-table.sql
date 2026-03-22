-- Student ID Table for SorSU Document Request System
-- This table contains valid student IDs that can be used for registration

-- ========================================
-- STUDENT IDs TABLE
-- ========================================

create table student_ids (
  id uuid default uuid_generate_v4() primary key,
  student_id text unique not null,
  is_active boolean default true,
  created_by uuid references profiles(id),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  notes text
);

-- ========================================
-- INDEXES FOR PERFORMANCE
-- ========================================

create index idx_student_ids_student_id on student_ids(student_id);
create index idx_student_ids_is_active on student_ids(is_active);
create index idx_student_ids_created_at on student_ids(created_at);

-- ========================================
-- ROW LEVEL SECURITY (RLS)
-- ========================================

alter table student_ids enable row level security;

-- ========================================
-- RLS POLICIES
-- ========================================

-- Admin can manage all student IDs
create policy "Admin can manage all student IDs" on student_ids for all using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- ========================================
-- TRIGGERS AND FUNCTIONS
-- ========================================

-- Update timestamp trigger
create or replace function public.update_student_ids_timestamp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Create trigger for updating timestamp
drop trigger if exists update_student_ids_timestamp_trigger on student_ids;
create trigger update_student_ids_timestamp_trigger
before update on student_ids
for each row execute procedure public.update_student_ids_timestamp();

-- ========================================
-- AUDIT TRIGGER
-- ========================================

-- Audit trigger for student_ids table
drop trigger if exists student_ids_audit on student_ids;
create trigger student_ids_audit
after insert or update or delete on student_ids
for each row execute procedure public.audit_trigger_function();

-- ========================================
-- SAMPLE DATA (for development)
-- ========================================

-- Insert sample student IDs for testing
-- In production, these should be added through the admin interface
insert into student_ids (student_id, notes) values
('2021001', 'Sample student ID for testing'),
('2021002', 'Sample student ID for testing'),
('2021003', 'Sample student ID for testing'),
('2021004', 'Sample student ID for testing'),
('2021005', 'Sample student ID for testing');

-- ========================================
-- COMMENTS
-- ========================================

/*
  Student ID Table Features:
  
  1. Student ID Validation:
     - Stores valid student IDs for registration validation
     - Active/inactive status for ID management
     - Audit trail for all changes
  
  2. Admin Management:
     - Full CRUD operations for admins
     - Notes field for additional context
     - Created by tracking
  
  3. Security:
     - Row Level Security (RLS) enabled
     - Admin-only access policies
     - Audit logging for compliance
  
  4. Performance:
     - Optimized indexes for lookups
     - Efficient validation queries
     - Timestamp tracking
  
  Usage:
  - Check if student ID exists and is active:
    SELECT COUNT(*) FROM student_ids WHERE student_id = ? AND is_active = true;
  
  - Add new student ID:
    INSERT INTO student_ids (student_id, notes) VALUES (?, ?);
  
  - Deactivate student ID:
    UPDATE student_ids SET is_active = false WHERE student_id = ?;
*/
