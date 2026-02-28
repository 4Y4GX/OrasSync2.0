// app/api/analyst/kpis/route.ts
import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await getUserFromCookie();
    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Check if user is analyst
    if (user.role_id !== 2) {
      return NextResponse.json({ message: "Forbidden: Analyst access only" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const deptId = searchParams.get("dept_id");
    const period = searchParams.get("period") || "week"; // week, month, year

    // Calculate date range
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    let startDate: Date;

    if (period === "week") {
      startDate = new Date(today);
      const dayOfWeek = today.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      startDate.setDate(today.getDate() - diff);
      startDate.setHours(0, 0, 0, 0);
    } else if (period === "month") {
      startDate = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0);
    } else {
      startDate = new Date(today.getFullYear(), 0, 1, 0, 0, 0, 0);
    }

    // Build where clause for filtering
    const whereClause: any = {
      log_date: {
        gte: startDate,
        lte: today,
      },
    };

    if (deptId && deptId !== "ALL") {
      whereClause.dept_id_at_log = parseInt(deptId);
    }

    // Get time logs with activity info
    const timeLogs = await prisma.d_tbltime_log.findMany({
      where: whereClause,
      include: {
        D_tblactivity: true,
        D_tbluser_D_tbltime_log_user_idToD_tbluser: {
          include: {
            D_tbldepartment: true,
          },
        },
      },
    });

    // Get clock logs for attendance calculation
    const clockLogs = await prisma.d_tblclock_log.findMany({
      where: {
        shift_date: {
          gte: startDate,
          lte: today,
        },
        ...(deptId && deptId !== "ALL" ? {
          D_tbluser: {
            dept_id: parseInt(deptId),
          },
        } : {}),
      },
      include: {
        D_tbluser: true,
      },
    });

    // Calculate KPIs
    const totalHours = timeLogs.reduce((sum, log) => sum + (log.total_hours?.toNumber() || 0), 0);
    const billableHours = timeLogs
      .filter(log => log.D_tblactivity?.is_billable)
      .reduce((sum, log) => sum + (log.total_hours?.toNumber() || 0), 0);
    const nonBillableHours = totalHours - billableHours;

    const billableRatio = totalHours > 0 ? (billableHours / totalHours) * 100 : 0;

    // Unique users who worked
    const uniqueUsers = new Set(clockLogs.map(log => log.user_id));
    const activeStaff = uniqueUsers.size;

    // Expected work days (based on clock logs)
    const expectedDays = clockLogs.length;
    const actualDays = clockLogs.filter(log => log.clock_out_time).length;
    const attendanceRate = expectedDays > 0 ? (actualDays / expectedDays) * 100 : 0;

    // Weekly activity (Monday to Saturday of the current week)
    const weeklyActivity: number[] = [];
    const currentDay = today.getDay(); // 0=Sun, 1=Mon, ...
    const mondayOffset = currentDay === 0 ? 6 : currentDay - 1;
    const monday = new Date(today);
    monday.setDate(today.getDate() - mondayOffset);
    monday.setHours(0, 0, 0, 0);

    for (let i = 0; i < 7; i++) { // Mon(0) to Sun(6)
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(date.getDate() + 1);

      const dayLogs = timeLogs.filter(log => {
        if (!log.log_date) return false;
        const logDate = new Date(log.log_date);
        return logDate >= date && logDate < nextDate;
      });

      const dayTotal = dayLogs.reduce((sum, log) => sum + (log.total_hours?.toNumber() || 0), 0);
      const percentage = dayTotal > 0 ? Math.min((dayTotal / 8) * 100, 100) : 0;
      weeklyActivity.push(Math.round(percentage));
    }

    // Department breakdown
    const departments = await prisma.d_tbldepartment.findMany({
      where: { is_active: true },
    });

    const deptBreakdown = await Promise.all(
      departments.map(async (dept) => {
        const deptLogs = timeLogs.filter(log => log.dept_id_at_log === dept.dept_id);
        const deptHours = deptLogs.reduce((sum, log) => sum + (log.total_hours?.toNumber() || 0), 0);
        const deptBillable = deptLogs
          .filter(log => log.D_tblactivity?.is_billable)
          .reduce((sum, log) => sum + (log.total_hours?.toNumber() || 0), 0);

        const deptUsers = new Set(deptLogs.map(log => log.user_id));

        return {
          dept_id: dept.dept_id,
          dept_name: dept.dept_name || "Unknown",
          total_hours: Math.round(deptHours * 100) / 100,
          billable_hours: Math.round(deptBillable * 100) / 100,
          billable_ratio: deptHours > 0 ? Math.round((deptBillable / deptHours) * 100) : 0,
          active_staff: deptUsers.size,
        };
      })
    );

    return NextResponse.json({
      period,
      kpis: {
        totalLogs: timeLogs.length,
        totalHours: Math.round(totalHours * 100) / 100,
        billableHours: Math.round(billableHours * 100) / 100,
        nonBillableHours: Math.round(nonBillableHours * 100) / 100,
        billableRatio: Math.round(billableRatio * 100) / 100,
        attendanceRate: Math.round(attendanceRate * 100) / 100,
        activeStaff,
      },
      weeklyActivity,
      departmentBreakdown: deptBreakdown,
    });
  } catch (error) {
    console.error("Get analyst KPIs error:", error);
    return NextResponse.json({ message: "Failed to fetch KPIs" }, { status: 500 });
  }
}
