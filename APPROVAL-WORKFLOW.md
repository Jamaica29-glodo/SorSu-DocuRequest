# Student Registration Approval Workflow

## Overview
This document describes the two-step approval system for student registrations in the SorSU Document Request System.

## Workflow Steps

### 1. Student Registration
1. Student fills out registration form at `/register`
2. System validates Student ID against `student_ids` table
3. If valid, account is created with `is_approved = false`
4. Student receives email verification link
5. After email verification, student still **cannot log in** until admin approval

### 2. Admin Approval
1. Admin logs in at `/admin/dashboard`
2. Dashboard shows "Pending Approval" students
3. Admin can review student details and approve/reject
4. Approval sets `is_approved = true` and records `approved_at` timestamp
5. Optional approval reason can be added

### 3. Student Login (After Approval)
1. Student attempts login at `/login`
2. System checks:
   - Valid credentials
   - Account not banned
   - **Account is approved** (for students)
3. If all checks pass, student can access the system

## Database Schema

### Profiles Table Approval Fields
```sql
is_approved BOOLEAN DEFAULT FALSE         -- Whether admin has approved the registration
is_banned BOOLEAN DEFAULT FALSE           -- Whether account is banned
approval_reason TEXT                      -- Reason for approval (optional)
ban_reason TEXT                          -- Reason for banning (optional)
approved_at TIMESTAMP WITH TIME ZONE       -- When approval was granted
banned_at TIMESTAMP WITH TIME ZONE         -- When ban was applied
```

### Student IDs Table
```sql
student_id TEXT UNIQUE NOT NULL            -- Valid student IDs for registration
is_active BOOLEAN DEFAULT TRUE             -- Whether ID can be used for registration
created_by UUID REFERENCES profiles(id)   -- Admin who added the ID
created_at TIMESTAMP DEFAULT NOW()         -- When ID was added
```

## User Experience

### Registration Flow
1. **Success Modal**: Shows detailed message about approval requirement
2. **Email Verification**: Standard Supabase email confirmation
3. **Login Attempt**: Clear error message if not approved
4. **Approval Notification**: Students know approval is required

### Admin Experience
1. **Dashboard Stats**: Shows pending approvals count
2. **Student Management**: Filter by "Pending Approval" status
3. **Approval Modal**: Review student details before approving
4. **Audit Trail**: All approvals are logged and tracked

## Security Features

### Multi-Layer Validation
1. **Student ID Validation**: Against approved IDs table
2. **Email Verification**: Standard Supabase confirmation
3. **Admin Approval**: Manual review and approval
4. **Login Checks**: Comprehensive validation on each login

### Access Control
- **Row Level Security**: Proper database permissions
- **Role-Based Access**: Different permissions for different roles
- **Audit Logging**: All actions are tracked
- **Ban System**: Separate from approval system

## Error Messages

### Registration Errors
- **Invalid Student ID**: "The Student ID you entered did not match any valid Sorsogon State University ID number..."
- **Duplicate Email**: Standard Supabase error handling

### Login Errors
- **Not Approved**: "Your registration is pending admin approval. Please wait for an administrator to approve your account."
- **Banned**: "Your account has been banned. Please contact the registrar office."
- **Invalid Credentials**: Standard authentication error

## Admin Interface Features

### Student Management
- **Status Filtering**: All, Pending, Approved, Banned
- **Search Functionality**: By name, ID, or email
- **Approval Actions**: Approve with optional reason
- **Ban Actions**: Separate ban system with reasons

### Statistics Dashboard
- **Total Students**: Overall student count
- **Pending Approvals**: Students awaiting approval
- **Approved Students**: Active, approved students
- **Banned Students**: Banned accounts
- **Recent Registrations**: New registrations (30 days)

## Testing Scenarios

### 1. Complete Successful Registration
1. Use valid Student ID (e.g., "2021001")
2. Complete registration form
3. Verify email
4. Try login (should fail with approval message)
5. Admin approves student
6. Student can now login

### 2. Invalid Student ID
1. Use invalid Student ID (e.g., "9999999")
2. Registration fails with validation error
3. No account is created

### 3. Banned User Login
1. Admin bans a student
2. Student tries to login
3. Login fails with ban message

### 4. Admin Approval Process
1. Admin views pending approvals
2. Reviews student details
3. Approves with optional reason
4. Student receives approval (can now login)

## Setup Instructions

### Database Setup
1. Run `student-id-table.sql` to create student IDs table
2. Run `add-approval-fields.sql` to add approval fields to profiles
3. Insert sample student IDs for testing

### Testing Setup
1. Create test student accounts
2. Verify approval workflow works
3. Test all error scenarios
4. Confirm admin interface functions

## File Structure

### Approval System Files
```
├── student-id-table.sql              # Student IDs table
├── add-approval-fields.sql           # Approval fields for profiles
├── app/admin/dashboard/page.tsx       # Admin approval interface
├── app/login/page.tsx               # Login with approval check
├── app/register/page.tsx             # Registration with approval message
└── components/ui/modal.tsx           # Success/error modals
```

## Best Practices

### For Admins
1. **Review Carefully**: Check student details before approving
2. **Add Reasons**: Document approval decisions
3. **Monitor Pending**: Regularly check for new registrations
4. **Communicate**: Inform students about approval status

### For Students
1. **Use Valid ID**: Only use official university Student IDs
2. **Check Email**: Verify email after registration
3. **Wait Patiently**: Approval may take time
4. **Contact Support**: If approval takes too long

## Troubleshooting

### Common Issues
1. **Student can't register**: Check if Student ID exists in student_ids table
2. **Student can't login**: Check if account is approved and not banned
3. **Admin can't approve**: Verify admin role and permissions
4. **Missing approval fields**: Run the database update script

### Database Checks
```sql
-- Check if approval fields exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('is_approved', 'approved_at', 'approval_reason');

-- Check pending approvals
SELECT COUNT(*) as pending_count 
FROM profiles 
WHERE role = 'student' AND is_approved = false AND is_banned = false;

-- Check student IDs
SELECT COUNT(*) as valid_ids 
FROM student_ids 
WHERE is_active = true;
```

---

**Note**: This approval system ensures that only legitimate students with valid Student IDs can access the system after proper administrative review.
