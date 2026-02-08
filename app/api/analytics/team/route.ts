// app/api/analytics/team/route.ts
import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await getUserFromCookie();
    if (!user || (user.role_id !== 2 && user.role_id !== 3 && user.role_id !== 4)) {
      return NextResponse.json({ message: "Unauthorized. Supervisor access required." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "week";

    // Calculate date range
    const today = new Date();
    const startDate = new Date(today);
    
    if (period === "week") {
      startDate.setDate(today.getDate() - 7);
    } else if (period === "month") {
      startDate.setMonth(today.getMonth() - 1);
    } else if (period === "year") {
      startDate.setFullYear(today.getFullYear() - 1);
    }

    let teamMemberIds: string[] = [];

    if (user.role_id === 2) {
      // Supervisor: get their team
      const teamMembers = await prisma.d_tbluser.findMany({
        where: {
          supervisor_id: user.user_id,
          account_status: "ACTIVE",
        },
        select: { user_id: true },
      });
      teamMemberIds = teamMembers.map(m => m.user_id);
    } else {
      // Manager/Admin: get all employees
      const employees = await prisma.d_tbluser.findMany({
        where: {
          role_id: 1,
          account_status: "ACTIVE",
        },
        select: { user_id: true },
      });
      teamMemberIds = employees.map(e => e.user_id);
    }

    // Get team time logs
    const timeLogs = await prisma.d_tbltime_log.findMany({
      where: {
        user_id: { in: teamMemberIds },
        log_date: {
          gte: startDate,
          lte: today,
        },
      },
      include: {
        D_tbluser: {
          select: {
            user_id: true,
            first_name: true,
            last_name: true,
          },
        },
        D_tblactivity: true,
      },
    });

    // Calculate team statistics
    const totalHours = timeLogs.reduce((sum, log) => sum + (log.total_hours?.toNumber() || 0), 0);
    const billableHours = timeLogs
      .filter(log => log.D_tblactivity?.is_billable)
      .reduce((sum, log) => sum + (log.total_hours?.toNumber() || 0), 0);

    // Per-member breakdown
    const memberStats: { [key: string]: any } = {};
    timeLogs.forEach(log => {
      const userId = log.user_id;
      if (!memberStats[userId]) {
        memberStats[userId] = {
          user_id: userId,
          name: `${log.D_tbluser?.first_name} ${log.D_tbluser?.last_name}`,
          totalHours: 0,
          billableHours: 0,
          nonBillableHours: 0,
          logCount: 0,
        };
      }
      const hours = log.total_hours?.toNumber() || 0;
      memberStats[userId].totalHours += hours;
      memberStats[userId].logCount += 1;
      if (log.D_tblactivity?.is_billable) {
        memberStats[userId].billableHours += hours;
      } else {
        memberStats[userId].nonBillableHours += hours;
      }
    });

    // Daily team hours for chart
    const dailyTeamHours: { [key: string]: number } = {};
    timeLogs.forEach(log => {
      const dateKey = log.log_date.toISOString().split('T')[0];
      dailyTeamHours[dateKey] = (dailyTeamHours[dateKey] || 0) + (log.total_hours?.toNumber() || 0);
    });

    // Top performers
    const topPerformers = Object.values(memberStats)
      .sort((a: any, b: any) => b.totalHours - a.totalHours)
      .slice(0, 5)
      .map((member: any) => ({
        ...member,
        totalHours: Math.round(member.totalHours * 100) / 100,
        billableHours: Math.round(member.billableHours * 100) / 100,
        nonBillableHours: Math.round(member.nonBillableHours * 100) / 100,
      }));

    // Productivity rate (billable / total)
    const productivityRate = totalHours > 0 ? (billableHours / totalHours) * 100 : 0;

    return NextResponse.json({
      period,
      teamSize: teamMemberIds.length,
      summary: {
        totalHours: Math.round(totalHours * 100) / 100,
        billableHours: Math.round(billableHours * 100) / 100,
        nonBillableHours: Math.round((totalHours - billableHours) * 100) / 100,
        productivityRate: Math.round(productivityRate * 100) / 100,
        avgHoursPerMember: Math.round((totalHours / teamMemberIds.length) * 100) / 100,
      },
      dailyTeamHours,
      topPerformers,
      memberStats: Object.values(memberStats).map((m: any) => ({
        ...m,
        totalHours: Math.round(m.totalHours * 100) / 100,
        billableHours: Math.round(m.billableHours * 100) / 100,
        nonBillableHours: Math.round(m.nonBillableHours * 100) / 100,
      })),
    });
  } catch (error) {
    console.error("Get team analytics error:", error);
    return NextResponse.json({ message: "Failed to fetch team analytics" }, { status: 500 });
  }
}
