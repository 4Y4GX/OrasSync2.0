// app/api/analyst/summary/route.ts
import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const ROLE_ANALYST = 2;
const ROLE_ADMIN = 3;

export async function GET() {
  try {
    const user = await getUserFromCookie();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Only analysts and admins can access this endpoint
    if (user.role_id !== ROLE_ANALYST && user.role_id !== ROLE_ADMIN) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    const today = new Date();
    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    // Calculate week ranges
    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(today.getDate() - today.getDay());
    thisWeekStart.setHours(0, 0, 0, 0);

    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(thisWeekStart);
    lastWeekEnd.setMilliseconds(-1);

    // Get this week's logs count
    const thisWeekLogs = await prisma.d_tbltime_log.count({
      where: {
        log_date: {
          gte: thisWeekStart,
          lte: todayEnd,
        },
      },
    });

    // Get last week's logs count
    const lastWeekLogs = await prisma.d_tbltime_log.count({
      where: {
        log_date: {
          gte: lastWeekStart,
          lte: lastWeekEnd,
        },
      },
    });

    // Calculate change percentage
    let totalLogsChange = 0;
    if (lastWeekLogs > 0) {
      totalLogsChange = ((thisWeekLogs - lastWeekLogs) / lastWeekLogs) * 100;
    }

    // Calculate average efficiency (based on completed vs total hours logged)
    const logsWithHours = await prisma.d_tbltime_log.findMany({
      where: {
        log_date: {
          gte: thisWeekStart,
          lte: todayEnd,
        },
        total_hours: { not: null },
      },
      select: { total_hours: true },
    });

    const totalHoursLogged = logsWithHours.reduce(
      (sum, log) => sum + (log.total_hours?.toNumber() || 0),
      0
    );

    // Calculate efficiency based on target hours (8h/day per active user)
    const uniqueUsersThisWeek = await prisma.d_tbltime_log.groupBy({
      by: ["user_id"],
      where: {
        log_date: {
          gte: thisWeekStart,
          lte: todayEnd,
        },
      },
    });

    const daysInWeek = Math.min(
      Math.ceil((todayEnd.getTime() - thisWeekStart.getTime()) / (1000 * 60 * 60 * 24)),
      7
    );
    const targetHours = uniqueUsersThisWeek.length * daysInWeek * 8;
    const avgEfficiency = targetHours > 0 ? (totalHoursLogged / targetHours) * 100 : 0;

    // Determine efficiency status
    let efficiencyStatus: string;
    if (avgEfficiency >= 90) {
      efficiencyStatus = "Optimal Range";
    } else if (avgEfficiency >= 70) {
      efficiencyStatus = "Below Target";
    } else {
      efficiencyStatus = "Critical";
    }

    // Count active personnel (users who clocked in today and haven't clocked out)
    const activePersonnel = await prisma.d_tblclock_log.count({
      where: {
        clock_in_time: {
          gte: todayStart,
          lte: todayEnd,
        },
        clock_out_time: null,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        totalLogs: thisWeekLogs,
        totalLogsChange: Math.round(totalLogsChange * 10) / 10,
        avgEfficiency: Math.round(avgEfficiency * 10) / 10,
        efficiencyStatus,
        activePersonnel,
      },
    });
  } catch (error) {
    console.error("Analyst summary error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch summary data" },
      { status: 500 }
    );
  }
}
