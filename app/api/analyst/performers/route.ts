// app/api/analyst/performers/route.ts
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
    if (user.role_id !== 5) {
      return NextResponse.json({ message: "Forbidden: Analyst access only" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const deptId = searchParams.get("dept_id");
    const period = searchParams.get("period") || "week";
    const topN = parseInt(searchParams.get("top_n") || "10");

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

    // Get time logs
    const timeLogs = await prisma.d_tbltime_log.findMany({
      where: {
        log_date: { gte: startDate, lte: today },
        ...(deptId && deptId !== "ALL" ? {
          dept_id_at_log: parseInt(deptId),
        } : {}),
      },
      include: {
        D_tbluser_D_tbltime_log_user_idToD_tbluser: {
          include: {
            D_tbldepartment: true,
            D_tblteam: true,
          },
        },
        D_tblactivity: true,
      },
    });

    // Calculate productivity metrics per user
    const userMetricsMap = new Map<string, any>();
    
    timeLogs.forEach(log => {
      if (!log.user_id) return;
      
      if (!userMetricsMap.has(log.user_id)) {
        userMetricsMap.set(log.user_id, {
          user_id: log.user_id,
          name: `${log.D_tbluser_D_tbltime_log_user_idToD_tbluser?.first_name || ""} ${log.D_tbluser_D_tbltime_log_user_idToD_tbluser?.last_name || ""}`.trim(),
          department: log.D_tbluser_D_tbltime_log_user_idToD_tbluser?.D_tbldepartment?.dept_name || "N/A",
          team: log.D_tbluser_D_tbltime_log_user_idToD_tbluser?.D_tblteam?.team_name || "N/A",
          total_hours: 0,
          billable_hours: 0,
          non_billable_hours: 0,
          days_worked: new Set<string>(),
          approved_hours: 0,
          pending_hours: 0,
        });
      }
      
      const userData = userMetricsMap.get(log.user_id);
      const hours = log.total_hours?.toNumber() || 0;
      
      userData.total_hours += hours;
      
      if (log.D_tblactivity?.is_billable) {
        userData.billable_hours += hours;
      } else {
        userData.non_billable_hours += hours;
      }
      
      if (log.log_date) {
        userData.days_worked.add(log.log_date.toISOString().split('T')[0]);
      }
      
      if (log.approval_status === "MANAGER_APPROVED" || log.approval_status === "SUPERVISOR_APPROVED") {
        userData.approved_hours += hours;
      } else if (log.approval_status === "PENDING") {
        userData.pending_hours += hours;
      }
    });

    // Convert to array and calculate scores
    const userMetrics = Array.from(userMetricsMap.values()).map(user => {
      const daysWorked = user.days_worked.size;
      const avgHoursPerDay = daysWorked > 0 ? user.total_hours / daysWorked : 0;
      const billableRatio = user.total_hours > 0 ? (user.billable_hours / user.total_hours) * 100 : 0;
      const approvalRate = user.total_hours > 0 ? (user.approved_hours / user.total_hours) * 100 : 0;
      
      // Productivity score calculation
      // Factors: total hours (40%), billable ratio (30%), approval rate (20%), consistency (10%)
      const hoursScore = Math.min((avgHoursPerDay / 8) * 100, 100);
      const billableScore = billableRatio;
      const approvalScore = approvalRate;
      const consistencyScore = daysWorked >= 5 ? 100 : (daysWorked / 5) * 100;
      
      const productivityScore = Math.round(
        (hoursScore * 0.4) +
        (billableScore * 0.3) +
        (approvalScore * 0.2) +
        (consistencyScore * 0.1)
      );
      
      return {
        ...user,
        days_worked: daysWorked,
        avg_hours_per_day: Math.round(avgHoursPerDay * 100) / 100,
        billable_ratio: Math.round(billableRatio * 100) / 100,
        approval_rate: Math.round(approvalRate * 100) / 100,
        productivity_score: productivityScore,
        total_hours: Math.round(user.total_hours * 100) / 100,
        billable_hours: Math.round(user.billable_hours * 100) / 100,
        non_billable_hours: Math.round(user.non_billable_hours * 100) / 100,
      };
    });

    // Sort by productivity score
    userMetrics.sort((a, b) => b.productivity_score - a.productivity_score);

    // Get top and bottom performers
    const topPerformers = userMetrics.slice(0, topN);
    const bottomPerformers = userMetrics.slice(-topN).reverse();

    // Calculate performance distribution
    const scoreRanges = {
      excellent: userMetrics.filter(u => u.productivity_score >= 90).length,
      good: userMetrics.filter(u => u.productivity_score >= 70 && u.productivity_score < 90).length,
      average: userMetrics.filter(u => u.productivity_score >= 50 && u.productivity_score < 70).length,
      below_average: userMetrics.filter(u => u.productivity_score < 50).length,
    };

    return NextResponse.json({
      period,
      totalUsers: userMetrics.length,
      topPerformers,
      bottomPerformers,
      performanceDistribution: scoreRanges,
      allUsers: userMetrics,
    });
  } catch (error) {
    console.error("Get performers analysis error:", error);
    return NextResponse.json({ message: "Failed to fetch performers data" }, { status: 500 });
  }
}
