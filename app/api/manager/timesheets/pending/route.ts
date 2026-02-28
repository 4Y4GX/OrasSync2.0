import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromCookie } from "@/lib/auth";

export async function GET() {
  const user = await getUserFromCookie();

  // 1. Authenticate and check role (Manager/Admin: 5, Supervisor: 4)
  if (!user || (user.role_id !== 5 && user.role_id !== 4)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    // 2. Fetch the logged-in manager's full record to get their dept_id
    // (Adjust 'user.user_id' if your session token uses a different property name like 'user.id')
    const managerData = await prisma.d_tbluser.findUnique({
      where: { user_id: user.user_id },
      select: { dept_id: true }
    });

    if (!managerData || !managerData.dept_id) {
      return NextResponse.json({ message: "Department not found for this user" }, { status: 400 });
    }

    // 3. Fetch all time logs for users in the manager's department AND who are Employees
    const rawTimeLogs = await prisma.d_tbltime_log.findMany({
      where: {
        // This ensures we only get logs from users in the manager's department
        D_tbluser_D_tbltime_log_user_idToD_tbluser: {
          dept_id: managerData.dept_id,
          // NEW: Ensures we only fetch timesheets belonging to the Employee role
          D_tblrole: {
            role_name: "Employee" 
          }
        }
      },
      include: {
        // Fetch User details (Prisma generated a long relation name here based on your schema)
        D_tbluser_D_tbltime_log_user_idToD_tbluser: {
          select: { first_name: true, last_name: true }
        },
        // Fetch Activity details
        D_tblactivity: {
          select: { activity_name: true, activity_code: true }
        }
      },
      orderBy: { log_date: 'desc' }
    });

    // 4. Group the raw time logs by Employee AND Date to create compiled daily timesheets
    const groupedData = rawTimeLogs.reduce((acc, curr) => {
      // Skip if essential data is missing
      if (!curr.user_id || !curr.log_date) return acc;

      // Create a clean date string (e.g., "2026-02-20") to use as part of the grouping key
      const dateString = curr.log_date.toISOString().split('T')[0];
      
      // Create a unique key for this employee on this specific day (e.g., "EMP001_2026-02-20")
      const groupKey = `${curr.user_id}_${dateString}`;

      // If this is the first time we're seeing this employee on this day, set up their daily sheet
      if (!acc[groupKey]) {
        const employee = curr.D_tbluser_D_tbltime_log_user_idToD_tbluser;
        acc[groupKey] = {
          user_id: curr.user_id,
          employee_name: employee ? `${employee.first_name} ${employee.last_name}` : "Unknown Employee",
          date: dateString,
          approval_status: curr.approval_status, // Useful to show if the day is Pending/Approved
          total_hours: 0,
          activities: [] 
        };
      }

      // In your schema, total_hours is a Decimal. We need to convert it to a Number to do math.
      const hoursSpent = curr.total_hours ? parseFloat(curr.total_hours.toString()) : 0;

      // Add the current task details into the employee's daily activities array
      acc[groupKey].activities.push({
        tlog_id: curr.tlog_id,
        activity_name: curr.D_tblactivity?.activity_name || "Unknown Activity",
        activity_code: curr.D_tblactivity?.activity_code || "N/A",
        start_time: curr.start_time,
        end_time: curr.end_time,
        hours: hoursSpent
      });

      // Add to the running total of hours for the day
      acc[groupKey].total_hours += hoursSpent;

      return acc;
    }, {} as Record<string, any>);

    // 5. Convert the grouped object back into a clean array for the frontend
    const compiledTimesheets = Object.values(groupedData);

    return NextResponse.json({ timesheets: compiledTimesheets });

  } catch (error) {
    console.error("Timesheet Compile Error:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}