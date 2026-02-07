# OraSync - Digital Timekeeping Application

## Project Overview

OraSync is a comprehensive web-based timekeeping application designed to replace manual, paper-based time tracking with digital time tracking and reviewing for better efficiency. The application tracks employee work hours, task categorization, and sentiment tracking to provide management with actionable insights into productivity.

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
```bash
npm run dev
```

Visit `http://localhost:3000` to access the application.

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

## Current Implementation Status

### ✅ Completed Features
- [x] Role-based dashboard pages (Admin, Manager, Supervisor)
- [x] Role-specific CSS themes with unique color schemes
- [x] Base dashboard components and layouts
- [x] Employee dashboard with clock in/out functionality
- [x] Authentication system with JWT
- [x] Sentiment tracking interface
- [x] Database schema with 39 tables
- [x] Prisma ORM integration

### 🚧 In Progress
- [ ] Real-time data integration with database
- [ ] API endpoints for dashboard data
- [ ] Timesheet approval workflow implementation

### 📋 Planned Features (Sprint 2-4)
- [ ] Activity tracking and task switching
- [ ] Admin user management CRUD operations
- [ ] Supervisor team schedule management
- [ ] Manager final approval workflow
- [ ] Analytics and reporting features
- [ ] Excel import/export functionality
- [ ] Real-time team status monitoring
- [ ] Email notifications
- [ ] Mobile responsive design

## Development Workflow

### Sprint Timeline
- **Sprint 0** (Dec 18 – Jan 7): Design & Architecture ✅
- **Sprint 1** (Jan 8 – Jan 21): Security & Identity ✅
- **Sprint 2** (Jan 22 – Feb 4): Core Workflow ✅
- **Sprint 3 Week 1** (Feb 5 – Feb 11): Activities & Scheduling 🚧
- **Sprint 3 Week 2** (Feb 12 – Feb 18): Approvals & Reporting 📋
- **Sprint 4** (Feb 19 – Mar 4): QA, Integration & Bug Fixing 📋
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
- **Presentation Date**: March 5, 2024

---

**Last Updated**: February 7, 2026
**Version**: MVP 1.0.0
**Status**: Active Development
