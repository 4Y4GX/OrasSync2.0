import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromCookie } from "@/lib/auth";

export async function GET(request: Request) {
  const user = await getUserFromCookie();

  if (!user || (user.role_id !== 5 && user.role_id !== 4)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  // Get the target employee ID from the URL query (?empId=ALL or ?empId=123)
  const { searchParams } = new URL(request.url);
  const targetEmpId = searchParams.get('empId');

  try {
    // 1. Verify the manager's department
    const managerData = await prisma.d_tbluser.findUnique({
      where: { user_id: user.user_id },
      select: { dept_id: true }
    });

    if (!managerData || !managerData.dept_id) {
      return NextResponse.json({ message: "Department not found" }, { status: 400 });
    }

    // 2. Determine which users to fetch (Either ALL in dept, or a specific user in dept)
    const userFilter: any = { dept_id: managerData.dept_id, role_id: { in: [1, 4] } };
    
    if (targetEmpId && targetEmpId !== 'ALL') {
        userFilter.user_id = targetEmpId;
    }

    const targetUsers = await prisma.d_tbluser.findMany({
        where: userFilter,
        select: { user_id: true }
    });

    const targetUserIds = targetUsers.map(u => u.user_id);

    if (targetUserIds.length === 0) {
        return NextResponse.json({ message: "No employees found to generate report." }, { status: 404 });
    }

    // 3. Fetch all timesheet logs for those users
    const logs = await prisma.d_tbltime_log.findMany({
        where: { user_id: { in: targetUserIds } },
        include: {
            D_tbluser_D_tbltime_log_user_idToD_tbluser: true,
            D_tblactivity: true
        },
        orderBy: { log_date: 'desc' }
    });

    // 4. Build the CSV String
    let csvContent = "Employee ID,Name,Date,Activity,Total Hours,Status\n";

    logs.forEach(log => {
        const empId = log.user_id;
        const name = `${log.D_tbluser_D_tbltime_log_user_idToD_tbluser?.first_name || ''} ${log.D_tbluser_D_tbltime_log_user_idToD_tbluser?.last_name || ''}`.trim();
        const date = log.log_date ? new Date(log.log_date).toLocaleDateString('en-US') : 'N/A';
        const activity = log.D_tblactivity?.activity_name || 'General';
        const hours = log.total_hours ? parseFloat(log.total_hours.toString()).toFixed(2) : '0.00';
        const status = log.approval_status || 'PENDING';

        // Escape commas in names or activities just to be safe
        const safeName = `"${name}"`;
        const safeActivity = `"${activity}"`;

        csvContent += `${empId},${safeName},${date},${safeActivity},${hours},${status}\n`;
    });

    // 5. Return as a downloadable file
    return new NextResponse(csvContent, {
        status: 200,
        headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="Department_Report_${new Date().toISOString().split('T')[0]}.csv"`
        }
    });

  } catch (error) {
    console.error("Report Export Error:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}