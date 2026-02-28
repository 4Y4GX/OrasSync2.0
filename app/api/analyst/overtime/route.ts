// app/api/analyst/overtime/route.ts
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
    const period = searchParams.get("period") || "week";

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

    // Get OT requests
    const otRequests = await prisma.d_tblot_request.findMany({
      where: {
        created_at: { gte: startDate, lte: today },
        ...(deptId && deptId !== "ALL" ? {
          D_tbluser: { dept_id: parseInt(deptId) },
        } : {}),
      },
      include: {
        D_tbluser: {
          include: {
            D_tbldepartment: true,
            D_tblteam: true,
          },
        },
      },
    });

    // Get early clockouts
    const earlyClockouts = await prisma.d_tblearly_reasonlog.findMany({
      where: {
        shift_date: { gte: startDate, lte: today },
        ...(deptId && deptId !== "ALL" ? {
          D_tbluser: { dept_id: parseInt(deptId) },
        } : {}),
      },
      include: {
        D_tbluser: {
          include: {
            D_tbldepartment: true,
            D_tblteam: true,
          },
        },
      },
    });

    // Analyze OT requests by user
    const userOTMap = new Map<string, any>();
    otRequests.forEach(req => {
      if (!req.user_id) return;

      if (!userOTMap.has(req.user_id)) {
        userOTMap.set(req.user_id, {
          user_id: req.user_id,
          name: `${req.D_tbluser?.first_name || ""} ${req.D_tbluser?.last_name || ""}`.trim(),
          department: req.D_tbluser?.D_tbldepartment?.dept_name || "N/A",
          team: req.D_tbluser?.D_tblteam?.team_name || "N/A",
          ot_count: 0,
          ot_requests: [],
        });
      }

      const userData = userOTMap.get(req.user_id);
      userData.ot_count++;
      userData.ot_requests.push({
        ot_id: req.ot_id,
        start_time: req.start_time,
        end_time: req.end_time,
        reason: req.reason,
        created_at: req.created_at,
      });
    });

    const otSummary = Array.from(userOTMap.values())
      .sort((a, b) => b.ot_count - a.ot_count);

    // Analyze early clockouts by user
    const userEarlyMap = new Map<string, any>();
    earlyClockouts.forEach(log => {
      if (!log.user_id) return;

      if (!userEarlyMap.has(log.user_id)) {
        userEarlyMap.set(log.user_id, {
          user_id: log.user_id,
          name: `${log.D_tbluser?.first_name || ""} ${log.D_tbluser?.last_name || ""}`.trim(),
          department: log.D_tbluser?.D_tbldepartment?.dept_name || "N/A",
          team: log.D_tbluser?.D_tblteam?.team_name || "N/A",
          early_count: 0,
          early_clockouts: [],
        });
      }

      const userData = userEarlyMap.get(log.user_id);
      userData.early_count++;
      userData.early_clockouts.push({
        reasonlog_id: log.reasonlog_id,
        shift_date: log.shift_date,
        reason: log.reason,
      });
    });

    const earlySummary = Array.from(userEarlyMap.values())
      .sort((a, b) => b.early_count - a.early_count);

    // Flag high-frequency users (potential issues)
    const otFlags = otSummary.filter(user => user.ot_count >= 3).map(user => ({
      ...user,
      flag_type: "HIGH_OT",
      flag_reason: `${user.ot_count} OT requests in ${period}`,
      severity: user.ot_count >= 5 ? "HIGH" : "MEDIUM",
    }));

    const earlyFlags = earlySummary.filter(user => user.early_count >= 2).map(user => ({
      ...user,
      flag_type: "FREQUENT_EARLY_CLOCKOUT",
      flag_reason: `${user.early_count} early clockouts in ${period}`,
      severity: user.early_count >= 4 ? "HIGH" : "MEDIUM",
    }));

    // Department breakdown
    const deptOTMap = new Map<string, number>();
    const deptEarlyMap = new Map<string, number>();

    otRequests.forEach(req => {
      const deptName = req.D_tbluser?.D_tbldepartment?.dept_name || "Unknown";
      deptOTMap.set(deptName, (deptOTMap.get(deptName) || 0) + 1);
    });

    earlyClockouts.forEach(log => {
      const deptName = log.D_tbluser?.D_tbldepartment?.dept_name || "Unknown";
      deptEarlyMap.set(deptName, (deptEarlyMap.get(deptName) || 0) + 1);
    });

    const departmentBreakdown = Array.from(
      new Set([...deptOTMap.keys(), ...deptEarlyMap.keys()])
    ).map(dept => ({
      department: dept,
      ot_requests: deptOTMap.get(dept) || 0,
      early_clockouts: deptEarlyMap.get(dept) || 0,
    }));

    return NextResponse.json({
      period,
      summary: {
        total_ot_requests: otRequests.length,
        total_early_clockouts: earlyClockouts.length,
        unique_users_with_ot: otSummary.length,
        unique_users_with_early: earlySummary.length,
      },
      overtimeRequests: otSummary,
      earlyClockouts: earlySummary,
      flags: [...otFlags, ...earlyFlags],
      departmentBreakdown,
    });
  } catch (error) {
    console.error("Get overtime analysis error:", error);
    return NextResponse.json({ message: "Failed to fetch overtime data" }, { status: 500 });
  }
}
