// app/api/analyst/kpis/route.ts
import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Helper: format a date range label for the period.
 * Week: "Mar 3 – Mar 9, 2026"
 * Month: "March 2026"
 * Year: "2026"
 */
function formatPeriodLabel(period: string, startDate: Date, endDate: Date): string {
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const fullMonthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  if (period === "week") {
    const startMonth = monthNames[startDate.getMonth()];
    const endMonth = monthNames[endDate.getMonth()];
    const startDay = startDate.getDate();
    const endDay = endDate.getDate();
    const year = endDate.getFullYear();
    if (startDate.getMonth() === endDate.getMonth()) {
      return `${startMonth} ${startDay} – ${endDay}, ${year}`;
    }
    return `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${year}`;
  } else if (period === "month") {
    return `${fullMonthNames[startDate.getMonth()]} ${startDate.getFullYear()}`;
  } else {
    return `${startDate.getFullYear()}`;
  }
}

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
    const offset = parseInt(searchParams.get("offset") || "0"); // 0 = current, -1 = previous, etc.

    // Calculate date range based on period + offset
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    if (period === "week") {
      // Find Monday of the current week
      const dayOfWeek = now.getDay();
      const mondayDiff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const monday = new Date(now);
      monday.setDate(now.getDate() - mondayDiff);
      monday.setHours(0, 0, 0, 0);

      // Apply offset (each offset unit = 7 days)
      startDate = new Date(monday);
      startDate.setDate(monday.getDate() + offset * 7);

      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
    } else if (period === "month") {
      // First day of current month + offset
      startDate = new Date(now.getFullYear(), now.getMonth() + offset, 1, 0, 0, 0, 0);

      // Last day of that month
      endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59, 999);
    } else {
      // year
      const targetYear = now.getFullYear() + offset;
      startDate = new Date(targetYear, 0, 1, 0, 0, 0, 0);
      endDate = new Date(targetYear, 11, 31, 23, 59, 59, 999);
    }

    const periodLabel = formatPeriodLabel(period, startDate, endDate);

    // Build where clause for filtering
    const whereClause: any = {
      log_date: {
        gte: startDate,
        lte: endDate,
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
          lte: endDate,
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

    // ====== DYNAMIC ACTIVITY BARS ======
    let activityBars: number[] = [];
    let activityLabels: string[] = [];

    if (period === "week") {
      // 7 bars: MON through SUN
      activityLabels = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
      for (let i = 0; i < 7; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
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
        activityBars.push(Math.round(percentage));
      }
    } else if (period === "month") {
      // 4-5 bars: one per week of the month
      // Week 1 = day 1-7, Week 2 = day 8-14, etc.
      const daysInMonth = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0).getDate();
      const numWeeks = Math.ceil(daysInMonth / 7);

      for (let w = 0; w < numWeeks; w++) {
        activityLabels.push(`WK ${w + 1}`);

        const weekStart = new Date(startDate);
        weekStart.setDate(startDate.getDate() + w * 7);
        weekStart.setHours(0, 0, 0, 0);

        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 7);
        // Cap to end of month
        const monthEnd = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59, 999);
        const cappedEnd = weekEnd > monthEnd ? monthEnd : weekEnd;

        const weekLogs = timeLogs.filter(log => {
          if (!log.log_date) return false;
          const logDate = new Date(log.log_date);
          return logDate >= weekStart && logDate <= cappedEnd;
        });

        // Calculate number of business days in this week segment (Mon-Fri)
        let businessDays = 0;
        for (let d = new Date(weekStart); d <= cappedEnd; d.setDate(d.getDate() + 1)) {
          const dow = d.getDay();
          if (dow >= 1 && dow <= 5) businessDays++;
        }

        const weekTotal = weekLogs.reduce((sum, log) => sum + (log.total_hours?.toNumber() || 0), 0);
        const maxHours = Math.max(businessDays * 8, 1); // prevent division by 0
        const percentage = weekTotal > 0 ? Math.min((weekTotal / maxHours) * 100, 100) : 0;
        activityBars.push(Math.round(percentage));
      }
    } else {
      // year: 12 bars, one per month
      activityLabels = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
      for (let m = 0; m < 12; m++) {
        const monthStart = new Date(startDate.getFullYear(), m, 1, 0, 0, 0, 0);
        const monthEnd = new Date(startDate.getFullYear(), m + 1, 0, 23, 59, 59, 999);

        const monthLogs = timeLogs.filter(log => {
          if (!log.log_date) return false;
          const logDate = new Date(log.log_date);
          return logDate >= monthStart && logDate <= monthEnd;
        });

        // Count business days in the month
        let businessDays = 0;
        for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
          const dow = d.getDay();
          if (dow >= 1 && dow <= 5) businessDays++;
        }

        const monthTotal = monthLogs.reduce((sum, log) => sum + (log.total_hours?.toNumber() || 0), 0);
        const maxHours = Math.max(businessDays * 8, 1);
        const percentage = monthTotal > 0 ? Math.min((monthTotal / maxHours) * 100, 100) : 0;
        activityBars.push(Math.round(percentage));
      }
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
      offset,
      periodLabel,
      kpis: {
        totalLogs: timeLogs.length,
        totalHours: Math.round(totalHours * 100) / 100,
        billableHours: Math.round(billableHours * 100) / 100,
        nonBillableHours: Math.round(nonBillableHours * 100) / 100,
        billableRatio: Math.round(billableRatio * 100) / 100,
        attendanceRate: Math.round(attendanceRate * 100) / 100,
        activeStaff,
      },
      activityBars,
      activityLabels,
      // Keep weeklyActivity for backward compat (same as activityBars for week period)
      weeklyActivity: period === "week" ? activityBars : [0, 0, 0, 0, 0, 0, 0],
      departmentBreakdown: deptBreakdown,
    });
  } catch (error) {
    console.error("Get analyst KPIs error:", error);
    return NextResponse.json({ message: "Failed to fetch KPIs" }, { status: 500 });
  }
}
