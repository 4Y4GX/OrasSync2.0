// app/api/analytics/dashboard/route.ts
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

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "week"; // week, month, year
    const userId = searchParams.get("user_id") || user.user_id;
    const startDateParam = searchParams.get("startDate"); // Optional: YYYY-MM-DD

    // Calculate date range
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today
    let startDate: Date;
    let endDate: Date = today;
    
    if (period === "week") {
      if (startDateParam) {
        // Use provided start date (expected to be a Monday)
        const [year, month, day] = startDateParam.split('-').map(Number);
        startDate = new Date(year, month - 1, day, 0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
      } else {
        // Get Monday of current week
        startDate = new Date(today);
        const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
        const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        startDate.setDate(today.getDate() - diff);
        startDate.setHours(0, 0, 0, 0);
      }
    } else if (period === "month") {
      startDate = new Date(today);
      startDate.setMonth(today.getMonth() - 1);
    } else if (period === "year") {
      startDate = new Date(today);
      startDate.setFullYear(today.getFullYear() - 1);
    } else {
      startDate = new Date(today);
      startDate.setDate(today.getDate() - 7);
    }

    // Get user's time logs
    const timeLogs = await prisma.d_tbltime_log.findMany({
      where: {
        user_id: userId,
        log_date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        D_tblactivity: true,
      },
    });

    // Calculate statistics
    const totalHours = timeLogs.reduce((sum, log) => sum + (log.total_hours?.toNumber() || 0), 0);
    const billableHours = timeLogs
      .filter(log => log.D_tblactivity?.is_billable)
      .reduce((sum, log) => sum + (log.total_hours?.toNumber() || 0), 0);
    const nonBillableHours = totalHours - billableHours;

    // Activity breakdown
    const activityBreakdown: { [key: string]: number } = {};
    timeLogs.forEach(log => {
      const activityName = log.D_tblactivity?.activity_name || "Unknown";
      activityBreakdown[activityName] = (activityBreakdown[activityName] || 0) + (log.total_hours?.toNumber() || 0);
    });

    // Daily hours for chart
    const dailyHours: { [key: string]: number } = {};
    timeLogs.forEach(log => {
      if (!log.log_date) return;
      // Use local date methods to match how dates are stored
      const d = new Date(log.log_date);
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      dailyHours[dateKey] = (dailyHours[dateKey] || 0) + (log.total_hours?.toNumber() || 0);
    });

    // Get clock logs for attendance
    const clockLogs = await prisma.d_tblclock_log.findMany({
      where: {
        user_id: userId,
        shift_date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const daysWorked = clockLogs.length;
    const avgHoursPerDay = daysWorked > 0 ? totalHours / daysWorked : 0;

    // Get user stats
    const userStats = await prisma.d_tbluser_stats.findUnique({
      where: { user_id: userId },
    });

    // Approval status breakdown
    const approvalStats = {
      pending: timeLogs.filter(log => log.approval_status === "PENDING").length,
      supervisor_approved: timeLogs.filter(log => log.approval_status === "SUPERVISOR_APPROVED").length,
      manager_approved: timeLogs.filter(log => log.approval_status === "MANAGER_APPROVED").length,
      rejected: timeLogs.filter(log => log.approval_status === "REJECTED").length,
    };

    return NextResponse.json({
      period,
      summary: {
        totalHours: Math.round(totalHours * 100) / 100,
        billableHours: Math.round(billableHours * 100) / 100,
        nonBillableHours: Math.round(nonBillableHours * 100) / 100,
        daysWorked,
        avgHoursPerDay: Math.round(avgHoursPerDay * 100) / 100,
        streakCount: userStats?.streak_count || 0,
      },
      activityBreakdown,
      dailyHours,
      approvalStats,
    });
  } catch (error) {
    console.error("Get analytics dashboard error:", error);
    return NextResponse.json({ message: "Failed to fetch analytics" }, { status: 500 });
  }
}
