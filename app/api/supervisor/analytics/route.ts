import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getUserFromCookie();
    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Check if user is a supervisor (using role_id 4 based on previous context)
    if (user.role_id !== 2 && user.role_id !== 4) {
      return NextResponse.json({ message: "Supervisor access only" }, { status: 403 });
    }

    // Get current week date range
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    // Get all team members supervised by this user
    // FIX: Changed 'status' to 'account_status' to match Prisma Schema
    const teamMembers = await prisma.d_tbluser.findMany({
      where: {
        supervisor_id: user.user_id,
        account_status: "ACTIVE", 
      },
      select: {
        user_id: true,
        first_name: true,
        last_name: true,
      },
    });

    const teamUserIds = teamMembers.map((m) => m.user_id);

    // Get all time logs for the team this week
    const weeklyLogs = await prisma.d_tbltime_log.findMany({
      where: {
        user_id: { in: teamUserIds },
        log_date: {
          gte: startOfWeek,
          lt: endOfWeek,
        },
        total_hours: { not: null },
      },
      select: {
        user_id: true,
        total_hours: true,
        log_date: true,
        D_tblactivity: {
          select: {
            is_billable: true,
          },
        },
      },
    });

    // Calculate total team hours this week
    // FIX: Convert Prisma Decimal to Number before adding
    const totalTeamHours = weeklyLogs.reduce(
      (sum, log) => sum + Number(log.total_hours || 0),
      0
    );

    // Calculate average hours per person
    const avgHoursPerPerson = teamMembers.length > 0
      ? totalTeamHours / teamMembers.length
      : 0;

    // Calculate productivity rate (billable hours / total hours)
    // FIX: Convert Prisma Decimal to Number before adding
    const billableHours = weeklyLogs
      .filter((log) => log.D_tblactivity?.is_billable)
      .reduce((sum, log) => sum + Number(log.total_hours || 0), 0);

    const productivityRate = totalTeamHours > 0
      ? Math.round((billableHours / totalTeamHours) * 100)
      : 0;

    // Calculate daily breakdown for bar chart
    const dailyBreakdown = [];
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      day.setHours(0, 0, 0, 0);

      const nextDay = new Date(day);
      nextDay.setDate(day.getDate() + 1);

      const dayLogs = weeklyLogs.filter((log) => {
        if (!log.log_date) return false; // FIX: Handle null dates
        const logDate = new Date(log.log_date);
        return logDate >= day && logDate < nextDay;
      });

      // FIX: Convert Prisma Decimal to Number before adding
      const dayHours = dayLogs.reduce((sum, log) => sum + Number(log.total_hours || 0), 0);

      dailyBreakdown.push({
        day: daysOfWeek[i],
        dayShort: daysOfWeek[i].substring(0, 3),
        hours: Math.round(dayHours * 10) / 10,
        date: day.toISOString().split('T')[0],
      });
    }

    return NextResponse.json({
      teamStats: {
        totalTeamHours: Math.round(totalTeamHours * 10) / 10,
        avgHoursPerPerson: Math.round(avgHoursPerPerson * 10) / 10,
        productivityRate,
        teamSize: teamMembers.length,
      },
      dailyBreakdown,
      weekRange: {
        start: startOfWeek.toISOString().split('T')[0],
        end: endOfWeek.toISOString().split('T')[0],
      },
    });
  } catch (error) {
    console.error("Supervisor analytics error:", error);
    return NextResponse.json(
      { message: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}