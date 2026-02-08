# OraSync - Digital Timekeeping Application

## Project Overview

OraSync is a comprehensive web-based timekeeping application designed to replace manual, paper-based time tracking with digital time tracking and reviewing for better efficiency. The application tracks employee work hours, task categorization, and sentiment tracking to provide management with actionable insights into productivity.

## Test Credentials

| Role | Email | Password | Dashboard Access |
|------|-------|----------|------------------|
| **Admin** | admin@orasync.com | Admin123!@# | User Management, Excel Import/Export, System Config |
| **Manager** | manager@orasync.com | Manager123!@# | Final Approval, Cross-Dept Analytics, Team Oversight |
| **Supervisor** | supervisor@orasync.com | Supervisor123!@# | Team Approval, Scheduling, Real-time Status |
| **Employee** | employee@orasync.com | Employee123!@# | Clock In/Out, Activity Tracking, Personal Analytics |

> ⚠️ **Important**: Change these default passwords in production! These are for testing/demo purposes only.

## Technology Stack

- **Frontend**: Next.js 16 with React 19
- **Backend**: Next.js API Routes
- **Database**: Railway MySQL with Prisma ORM
- **Authentication**: JWT-based with SHA256 password hashing
- **Styling**: CSS with role-specific themes

## Database Architecture

The application uses 39 database tables organized into several categories:

### Core Tables
- **D_tbluser**: Core employee profiles, hierarchy, and employment dates
- **D_tbluser_authentication**: Password management and login security
- **D_tbluser_security_answers**: Security questions for account recovery
- **D_tblrole**: Defines organizational roles and access levels
- **D_tblposition**: Employee job titles and designations
- **D_tbldepartment**: List of company departments
- **D_tblteam**: Specific teams mapped to parent departments

### Time Tracking Tables
- **D_tblclock_log**: Daily clock in/out records
- **D_tbltime_log**: Detailed activity time logs with approval workflow
- **D_tblbreak_log**: Break time tracking
- **D_tblearly_reasonlog**: Justifications for early clock-outs
- **D_tblweekly_schedule**: Weekly shift schedules per employee
- **D_tblshift_template**: Reusable shift templates

### Monitoring & Security Tables
- **D_tblsentiment_log**: Daily sentiment analysis records
- **D_tblactivity**: Billable/Non-Billable activity types
- **D_tblaudit_log**: System audit trail (who changed what and when)
- **D_tblaccount_recovery_incident**: Security incident tracking
- **D_tblotp_log**: OTP verification for password recovery
- **D_tbluser_stats**: User attendance performance and streaks

## Features by Role

### Admin Role
- **User Management**: Create, update, and deactivate user accounts
- **Bulk Operations**: Upload Excel files for new hires or resigned employees
- **Security Management**: Manage role assignments and access levels
- **Audit Access**: View all system logs and track changes
- **Organizational Reporting**: Generate and export attendance reports
- **System Configuration**: Manage application settings and parameters

### Manager Role
- **Final Approval**: Approve or reject timesheets after supervisor review
- **Department Overview**: Monitor productivity across all departments
- **Cross-Team Analytics**: Compare performance between teams
- **Schedule Management**: Upload employee schedules when supervisors are absent
- **Supervisor Assignment**: Manage supervisor-to-team mappings
- **Executive Dashboard**: High-level productivity metrics and trends

### Supervisor Role
- **Team Review**: Review and approve team member timesheets
- **Schedule Management**: Upload and manage team/employee work schedules
- **Real-time Monitoring**: View current status of assigned team members
- **Team Analytics**: Track team performance and productivity
- **Activity Oversight**: Monitor what team members are working on
- **Timesheet Workflow**: Review, approve, or reject time entries

### Employee Role
- **Clock In/Out**: Time tracking with schedule validation
- **Activity Tracking**: Start/End/Switch work tasks in real-time
- **Sentiment Analysis**: Mandatory daily mood check-in
- **Early Clock-out Justification**: Provide reasons for leaving early
- **Personal Dashboard**: View timesheets and performance analytics
- **Performance Tracking**: Monitor productivity vs. targets

## Key Features

### 1. Mandatory Sentiment Analysis
- Daily sentiment check-in on login
- Options: Great, Okay, Not Good (with reason comments)
- Provides supervisors insights on employee morale and burnout risks
- Correlates productivity with employee well-being

### 2. Step-up Authentication
- Switching from higher to lower level roles: No password required
- Switching from lower to higher level roles: Password required
- Prevents unauthorized access when account is left unattended

### 3. Schedule-based Clock-in Control
- Employees cannot clock in without a set schedule
- Supervisors or managers must upload schedules first
- Prevents timesheet discrepancies and unauthorized overtime

### 4. Comprehensive Security
- **SHA256 Password Hashing**: Secure password storage
- **Account Lockout**: 3-attempt failure limit with automatic lockout
- **Security Questions**: Multi-factor account recovery
- **Audit Logging**: Complete trail of all system changes
- **Session Management**: Secure JWT-based authentication

## Project Structure

```
webapp/
├── app/
│   ├── admin/dashboard/          # Admin dashboard page
│   ├── manager/dashboard/        # Manager dashboard page
│   ├── supervisor/dashboard/     # Supervisor dashboard page
│   ├── employee/                 # Employee dashboard and features
│   │   ├── dashboard/           # Main employee dashboard
│   │   ├── sentiment/           # Sentiment tracking page
│   │   └── timesheet/           # Timesheet view page
│   ├── auth/                    # Authentication pages
│   │   ├── change-password/    # Password change flow
│   │   ├── forgot-password/    # Password recovery
│   │   └── reset-password/     # Password reset
│   ├── api/                     # Backend API routes
│   │   ├── auth/               # Authentication endpoints
│   │   └── employee/           # Employee-specific endpoints
│   ├── styles/                  # Global CSS files
│   │   ├── dashboard.css       # Base dashboard styles
│   │   ├── admin.css          # Admin theme (Crimson)
│   │   ├── manager.css        # Manager theme (Gold)
│   │   └── supervisor.css     # Supervisor theme (Purple)
│   ├── components/             # Reusable React components
│   └── login/                  # Login page
├── lib/                        # Utility libraries
│   ├── auth.ts                # Authentication utilities
│   ├── db.ts                  # Database connection
│   ├── schedule.ts            # Schedule validation
│   └── zeroTrustValidation.ts # Security validation
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── seed.ts                # Database seeding script
└── public/                    # Static assets
```

## Installation & Setup

### 1. Clone and Install Dependencies
```bash
cd /home/user/webapp
npm install
```

### 2. Configure Environment Variables
The `.env` file should contain:
```env
DATABASE_URL="mysql://user:pass@host:port/database"
JWT_SECRET="your-jwt-secret-key"
RECOVERY_SESSION_SECRET="your-recovery-session-secret"
RECOVERY_TOKEN_SECRET="your-recovery-token-secret"
```

### 3. Database Setup
```bash
# Generate Prisma Client
npx prisma generate

# Run migrations (if needed)
npx prisma db push

# Seed the database (optional)
npx prisma db seed
```

### 4. Run Development Server

**IMPORTANT: Use PM2 for running the development server**

```bash
# Build the application first
npm run build

# Start with PM2 (recommended for development in sandbox)
npm run build && pm2 start ecosystem.config.cjs

# Check service status
pm2 list

# View logs (non-blocking)
pm2 logs webapp --nostream

# Restart if needed
fuser -k 3000/tcp && pm2 restart webapp

# Test the service
curl http://localhost:3000
```

### 5. Build for Production
```bash
npm run build
npm run start
```

## Database Connection

The application is configured to use Railway MySQL database:
- **Host**: hopper.proxy.rlwy.net:12751
- **Database**: railway
- **Provider**: MySQL with Prisma ORM

## 🔑 Test Accounts / Login Credentials

For testing and demonstration purposes, use these accounts to login with different roles:

### Admin Account (role_id: 4)
```
Email:    admin@orasync.com
Password: Admin123!@#
```
**Access Level:** Full system access
- User management (create, update, deactivate)
- Excel import/export
- System configuration
- Audit logs
- All analytics and reports

### Manager Account (role_id: 3)
```
Email:    manager@orasync.com
Password: Manager123!@#
```
**Access Level:** Management oversight
- Final timesheet approval
- Cross-department analytics
- Supervisor assignment
- Schedule management (when supervisor absent)
- Team performance metrics

### Supervisor Account (role_id: 2)
```
Email:    supervisor@orasync.com
Password: Supervisor123!@#
```
**Access Level:** Team management
- Team timesheet review and approval
- Schedule management for team
- Real-time team status monitoring
- Team analytics
- Activity oversight

### Employee Account (role_id: 1)
```
Email:    employee@orasync.com
Password: Employee123!@#
```
**Access Level:** Basic user
- Clock in/out
- Activity tracking (start/switch/end tasks)
- Daily sentiment check-in
- Personal timesheet view
- Personal analytics dashboard

### 🔐 Password Requirements
- **Length**: 15-20 characters minimum
- **Complexity**: Must include uppercase, lowercase, numbers, and special characters
- **First Login**: System forces password change on first login
- **Email Domain**: Must use @gmail.com or @orasync.com domains
- **Security**: SHA256 hashing with salt

### 🚨 Important Notes
1. **Change Default Passwords**: These are test credentials. In production, change all default passwords immediately.
2. **First Login Flow**: On first login, users will be prompted to:
   - Change their password
   - Set up security questions
   - Complete profile information
3. **Account Lockout**: 3 failed login attempts will lock the account
4. **Session Management**: JWT tokens expire after configured duration (default: 8 hours)

### 📝 Creating Additional Test Users
To create more test users, use the Admin dashboard:
1. Login as Admin
2. Navigate to "Users" section
3. Click "Create New User"
4. Fill in required fields:
   - Email (must be @gmail.com)
   - First Name, Last Name
   - Role, Department, Position, Team
   - Initial temporary password
5. User will be forced to change password on first login

## Current Implementation Status

### ✅ Completed Features (Sprint 1-3)

#### Authentication & Security (Sprint 1)
- [x] Role-based dashboard pages (Admin, Manager, Supervisor, Employee)
- [x] Role-specific CSS themes with unique color schemes
- [x] Authentication system with JWT and SHA256 password hashing
- [x] Account lockout and recovery system
- [x] Security questions and OTP verification
- [x] Database schema with 39 tables and Prisma ORM

#### Core Workflow (Sprint 2)
- [x] Employee clock in/out with schedule validation
- [x] Sentiment tracking interface (mandatory daily check-in)
- [x] Early clock-out justification system
- [x] Personal timesheet view

#### Activity Tracking (Sprint 3 Week 1) ✅ NEW
- [x] Real-time activity start/switch/end functionality
- [x] Duration tracking with live timers
- [x] Activity list with billable/non-billable indicators
- [x] Activity history and logging
- [x] Integration with employee dashboard

#### Admin User Management (Sprint 3 Week 1) ✅ NEW
- [x] Complete CRUD operations for user management
- [x] Create users with profile details and initial password
- [x] Edit user information (role, department, position, team)
- [x] Deactivate users (soft delete with audit trail)
- [x] Advanced search and filtering (by role, status, keyword)
- [x] Pagination for large datasets
- [x] Metadata management for dropdowns

#### Supervisor Schedule Management (Sprint 3 Week 1) ✅ NEW
- [x] Weekly schedule management for team members
- [x] Create/edit/delete schedules per employee
- [x] Day-by-day shift assignment (Monday-Sunday)
- [x] Shift template integration
- [x] Visual schedule matrix display
- [x] Team member access control

#### Manager Approval Workflow (Sprint 3 Week 2) ✅ NEW
- [x] Two-level timesheet approval (Supervisor → Manager)
- [x] View pending timesheets by role and status
- [x] Approve individual or bulk timesheets
- [x] Reject timesheets with mandatory reason
- [x] Approval status tracking and filtering
- [x] Complete audit trail for all actions

#### Real-time Team Monitoring (Sprint 3 Week 2) ✅ NEW
- [x] Live team member status display
- [x] Current activity per team member
- [x] Hours worked today calculation
- [x] Clock in/out time tracking
- [x] Billable vs non-billable activity indicators
- [x] Department and team organization

#### Analytics & Reporting (Sprint 3 Week 3) ✅ NEW
- [x] Analytics dashboard with charts and metrics
- [x] Team performance analytics
- [x] Individual productivity tracking
- [x] Billable vs non-billable hours breakdown
- [x] Weekly/monthly trends visualization
- [x] Multi-role analytics (Admin, Supervisor, Employee)

#### Excel Import/Export (Sprint 3 Week 3) ✅ NEW
- [x] User data export to Excel (CSV)
- [x] Timesheet export with filters
- [x] Bulk user import from Excel/CSV
- [x] Data validation and error reporting
- [x] Template download functionality
- [x] Admin and Supervisor access

#### Real-time Team Status UI (Sprint 3 Week 3) ✅ NEW
- [x] Live team status dashboard component
- [x] Current activity visualization
- [x] Clock status indicators
- [x] Hours worked display
- [x] Team member filtering
- [x] Auto-refresh capabilities

### 🚧 API Endpoints Implemented

#### Employee APIs
- `POST /api/employee/clock/in` - Clock in with schedule validation
- `POST /api/employee/clock/out` - Clock out with early leave detection
- `GET /api/employee/clock/status` - Current clock and schedule status
- `POST /api/employee/sentiment` - Daily sentiment submission
- `GET /api/employee/sentiment/status` - Sentiment completion check
- `GET /api/employee/timesheet` - Personal timesheet view
- `POST /api/employee/activity/start` - Start new activity
- `POST /api/employee/activity/switch` - Switch activities
- `POST /api/employee/activity/end` - End current activity
- `GET /api/employee/activity/current` - Current activity status
- `GET /api/employee/activity/list` - Available activities

#### Admin APIs
- `GET /api/admin/users/list` - List users (paginated, filtered)
- `POST /api/admin/users/create` - Create new user
- `PUT /api/admin/users/update` - Update user details
- `DELETE /api/admin/users/delete` - Deactivate user
- `GET /api/admin/users/[user_id]` - Single user details
- `GET /api/admin/metadata` - Dropdowns metadata

#### Supervisor APIs
- `GET /api/supervisor/schedules/list` - Team schedules
- `POST /api/supervisor/schedules/create` - Create schedule
- `PUT /api/supervisor/schedules/update` - Update schedule
- `DELETE /api/supervisor/schedules/delete` - Delete schedule
- `GET /api/supervisor/shifts/list` - Shift templates
- `GET /api/supervisor/team/members` - Team members
- `GET /api/supervisor/team/status` - Real-time team status

#### Manager APIs
- `GET /api/manager/timesheets/pending` - Pending timesheets
- `POST /api/manager/timesheets/approve` - Approve (bulk)
- `POST /api/manager/timesheets/reject` - Reject with reason

#### Analytics APIs
- `GET /api/analytics/dashboard` - Personal analytics dashboard
- `GET /api/analytics/team` - Team analytics (Supervisor/Manager)

#### Import/Export APIs
- `GET /api/export/users` - Export users to CSV
- `GET /api/export/timesheets` - Export timesheets to CSV
- `POST /api/import/users` - Bulk import users from CSV

### 📋 Remaining Features (Sprint 4)
- [ ] Email notifications system

## Development Workflow

### Sprint Timeline
- **Sprint 0** (Dec 18 – Jan 7): Design & Architecture ✅
- **Sprint 1** (Jan 8 – Jan 21): Security & Identity ✅
- **Sprint 2** (Jan 22 – Feb 4): Core Workflow ✅
- **Sprint 3 Week 1** (Feb 5 – Feb 11): Activities & Scheduling ✅
- **Sprint 3 Week 2** (Feb 12 – Feb 18): Approvals & Monitoring ✅
- **Sprint 3 Week 3** (Feb 19 – Feb 25): Analytics & Reporting ✅
- **Sprint 4** (Feb 26 – Mar 4): QA, Integration & Bug Fixing 📋
- **Final Presentation**: March 5

## Role-Based Access Control

### Admin (role_id: 4)
- Full system access
- User lifecycle management
- Security and audit log access
- System configuration

### Manager (role_id: 3)
- All Supervisor permissions
- Final timesheet approval
- Cross-department analytics
- Supervisor assignment management

### Supervisor (role_id: 2)
- All Employee permissions
- Team timesheet review
- Schedule management
- Real-time team monitoring

### Employee (role_id: 1)
- Clock in/out
- Activity tracking
- Sentiment check-in
- Personal timesheet view

## Security Features

### Password Security
- SHA256 hashing algorithm
- 15-20 character minimum length
- @gmail.com domain restriction for initial setup
- Force password change on first login

### Account Protection
- 3-attempt login failure limit
- Automatic account lockout
- Security question recovery
- OTP verification for password reset

### Audit Trail
- All user actions logged
- Timestamp tracking
- Change history (old value → new value)
- User attribution for all changes

## UI Themes

### Admin Theme - Crimson Command
- Primary Color: #ff0055 (Crimson Red)
- Secondary Color: #9ca3af (Silver Gray)
- Accent Glow: Crimson with shadow effects

### Manager Theme - Executive Gold
- Primary Color: #fbbf24 (Golden Yellow)
- Secondary Color: #f59e0b (Amber)
- Accent Glow: Gold with warm shadows

### Supervisor Theme - Amethyst Purple
- Primary Color: #a78bfa (Amethyst)
- Secondary Color: #7c3aed (Deep Purple)
- Accent Glow: Purple with mystical shadows

## API Endpoints

### Authentication
- `POST /api/login` - User login
- `POST /api/logout` - User logout
- `POST /api/auth/first-login` - First login password change
- `POST /api/auth/reset-password` - Password reset
- `POST /api/auth/otp/generate` - Generate OTP
- `POST /api/auth/otp/verify` - Verify OTP
- `POST /api/auth/security-question` - Security question validation

### Employee
- `POST /api/employee/clock/in` - Clock in
- `POST /api/employee/clock/out` - Clock out
- `GET /api/employee/clock/status` - Get current clock status
- `POST /api/employee/sentiment` - Submit sentiment
- `GET /api/employee/sentiment/status` - Check sentiment status
- `GET /api/employee/timesheet` - View personal timesheet

## Contributing

This is an academic project for Software Engineering 1. For questions or issues, please contact the development team.

## License

This project is developed as part of an academic curriculum. All rights reserved.

## Contact

- **Project**: OraSync Digital Timekeeping Application
- **Course**: Software Engineering 1
- **Presentation Date**: March 5, 2026

---

**Last Updated**: February 8, 2026  
**Version**: MVP 2.0.1  
**Status**: Sprint 3 Completed - All Major Features Implemented ✅  
**Test Credentials**: Available for all roles (see Quick Start section)
