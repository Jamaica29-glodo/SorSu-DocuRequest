-- Admin System Database Schema Update
-- Add admin functionality to existing SorSU Document Request System

-- ========================================
-- 1. UPDATE PROFILES TABLE FOR ADMIN SYSTEM
-- ========================================

-- Add admin-specific fields to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_approved boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS is_banned boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS approval_reason text,
ADD COLUMN IF NOT EXISTS ban_reason text,
ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS banned_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS approved_by uuid references profiles(id),
ADD COLUMN IF NOT EXISTS banned_by uuid references profiles(id);

-- Update role check to include admin
ALTER TABLE profiles 
DROP CONSTRAINT IF EXISTS profiles_role_check,
ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('student', 'registrar', 'admin'));

-- ========================================
-- 2. CREATE ADMIN ACTIONS TABLE
-- ========================================

CREATE TABLE IF NOT EXISTS admin_actions (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  admin_id uuid REFERENCES profiles(id) NOT NULL,
  target_user_id uuid REFERENCES profiles(id) NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('approve', 'decline', 'ban', 'unban')),
  action_reason TEXT,
  email_sent BOOLEAN DEFAULT false,
  email_content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- 3. UPDATE RLS POLICIES FOR ADMIN ACCESS
-- ========================================

-- Drop existing policies that need updating
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Registrar can view all profiles" ON profiles;

-- Recreate policies with admin access
CREATE POLICY "Users can view own profile" ON profiles 
FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles 
FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles 
FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Admin and Registrar can view all profiles" ON profiles 
FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'registrar'))
);

CREATE POLICY "Admin can manage user profiles" ON profiles 
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- Admin actions policies
ALTER TABLE admin_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view all actions" ON admin_actions 
FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admin can create actions" ON admin_actions 
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ========================================
-- 4. CREATE ANALYTICS VIEWS
-- ========================================

-- Document request analytics by type
CREATE OR REPLACE VIEW document_request_analytics AS
SELECT 
  document_type,
  COUNT(*) as total_requests,
  COUNT(*) FILTER (WHERE status = 'Completed') as completed_requests,
  COUNT(*) FILTER (WHERE status = 'Pending') as pending_requests,
  COUNT(*) FILTER (WHERE status = 'On Process') as processing_requests,
  COUNT(*) FILTER (WHERE status = 'Ready for Pick-up') as ready_requests,
  DATE_TRUNC('month', created_at) as request_month,
  DATE_TRUNC('year', created_at) as request_year
FROM requests 
GROUP BY document_type, DATE_TRUNC('month', created_at), DATE_TRUNC('year', created_at)
ORDER BY request_year DESC, request_month DESC, total_requests DESC;

-- Student registration analytics
CREATE OR REPLACE VIEW student_registration_analytics AS
SELECT 
  COUNT(*) as total_students,
  COUNT(*) FILTER (WHERE is_approved = true) as approved_students,
  COUNT(*) FILTER (WHERE is_approved = false) as pending_students,
  COUNT(*) FILTER (WHERE is_banned = true) as banned_students,
  DATE_TRUNC('month', created_at) as registration_month,
  DATE_TRUNC('year', created_at) as registration_year
FROM profiles 
WHERE role = 'student'
GROUP BY DATE_TRUNC('month', created_at), DATE_TRUNC('year', created_at)
ORDER BY registration_year DESC, registration_month DESC;

-- Most requested documents (all time)
CREATE OR REPLACE VIEW most_requested_documents AS
SELECT 
  document_type,
  COUNT(*) as request_count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM requests
GROUP BY document_type
ORDER BY request_count DESC;

-- ========================================
-- 5. CREATE ADMIN FUNCTIONS
-- ========================================

-- Function to approve student
CREATE OR REPLACE FUNCTION approve_student(
  target_user_id UUID,
  approval_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_role TEXT;
BEGIN
  -- Check if current user is admin
  SELECT role INTO admin_role FROM profiles WHERE id = auth.uid();
  
  IF admin_role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can approve students';
  END IF;
  
  -- Update student profile
  UPDATE profiles 
  SET 
    is_approved = true,
    approval_reason = approval_reason,
    approved_at = NOW(),
    approved_by = auth.uid()
  WHERE id = target_user_id AND role = 'student';
  
  -- Log admin action
  INSERT INTO admin_actions (admin_id, target_user_id, action_type, action_reason)
  VALUES (auth.uid(), target_user_id, 'approve', approval_reason);
  
  RETURN true;
END;
$$;

-- Function to ban student
CREATE OR REPLACE FUNCTION ban_student(
  target_user_id UUID,
  ban_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_role TEXT;
BEGIN
  -- Check if current user is admin
  SELECT role INTO admin_role FROM profiles WHERE id = auth.uid();
  
  IF admin_role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can ban students';
  END IF;
  
  -- Update student profile
  UPDATE profiles 
  SET 
    is_banned = true,
    ban_reason = ban_reason,
    banned_at = NOW(),
    banned_by = auth.uid()
  WHERE id = target_user_id AND role = 'student';
  
  -- Log admin action
  INSERT INTO admin_actions (admin_id, target_user_id, action_type, action_reason)
  VALUES (auth.uid(), target_user_id, 'ban', ban_reason);
  
  RETURN true;
END;
$$;

-- Function to unban student
CREATE OR REPLACE FUNCTION unban_student(
  target_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_role TEXT;
BEGIN
  -- Check if current user is admin
  SELECT role INTO admin_role FROM profiles WHERE id = auth.uid();
  
  IF admin_role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can unban students';
  END IF;
  
  -- Update student profile
  UPDATE profiles 
  SET 
    is_banned = false,
    ban_reason = NULL,
    banned_at = NULL,
    banned_by = NULL
  WHERE id = target_user_id AND role = 'student';
  
  -- Log admin action
  INSERT INTO admin_actions (admin_id, target_user_id, action_type, action_reason)
  VALUES (auth.uid(), target_user_id, 'unban', 'Student unbanned by admin');
  
  RETURN true;
END;
$$;

-- ========================================
-- 6. CREATE INDEXES FOR PERFORMANCE
-- ========================================

CREATE INDEX IF NOT EXISTS idx_profiles_is_approved ON profiles(is_approved);
CREATE INDEX IF NOT EXISTS idx_profiles_is_banned ON profiles(is_banned);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_admin_actions_admin_id ON admin_actions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_target_user_id ON admin_actions(target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_action_type ON admin_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_admin_actions_created_at ON admin_actions(created_at);

-- ========================================
-- 7. UPDATE EXISTING TRIGGERS
-- ========================================

-- Update new user handler to set approval status for students
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    student_id,
    full_name,
    email_address,
    course_program,
    contact_number,
    role,
    is_approved
  )
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'student_id',
    NEW.raw_user_meta_data->>'full_name',
    NEW.email,
    NEW.raw_user_meta_data->>'course_program',
    NEW.raw_user_meta_data->>'contact_number',
    COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
    CASE 
      WHEN COALESCE(NEW.raw_user_meta_data->>'role', 'student') = 'student' THEN false
      ELSE true -- Admin and registrar are auto-approved
    END
  );

  RETURN NEW;
END;
$$;

-- ========================================
-- 8. SAMPLE ADMIN USER CREATION
-- ========================================

-- Create a default admin user (for development)
-- In production, create the first admin through direct database access
-- INSERT INTO auth.users (
--   instance_id,
--   id,
--   aud,
--   role,
--   email,
--   encrypted_password,
--   email_confirmed_at,
--   created_at,
--   updated_at,
--   last_sign_in_at,
--   raw_user_meta_data
-- ) VALUES (
--   '00000000-0000-0000-0000-000000000000',
--   gen_random_uuid(),
--   'authenticated',
--   'authenticated',
--   'admin@sorsu.edu.ph',
--   '$2b$10$...', -- Hashed password for 'admin123'
--   NOW(),
--   NOW(),
--   NOW(),
--   NOW(),
--   NOW(),
--   '{"role": "admin", "full_name": "System Administrator"}'
-- );

COMMIT;
