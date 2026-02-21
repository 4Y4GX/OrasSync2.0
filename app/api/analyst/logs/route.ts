// app/api/analyst/logs/route.ts
import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const ROLE_ANALYST = 2;
const ROLE_ADMIN = 3;

type LogStatus = "OK" | "HIGH" | "LOW";

function getStatusFromHours(hours: number): LogStatus {
  if (hours >= 7.0 && hours <= 8.5) return "OK";
  if (hours > 8.5) return "HIGH";
  return "LOW";
}

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const department = searchParams.get("department");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") || "20")), 100);
    const skip = (page - 1) * limit;

    // Build department filter
    const departmentFilter = department
      ? {
          D_tbldepartment: {
            dept_name: department,
          },
        }
      : {};

    // Get today's date for the query
    const today = new Date();
    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    // Get logs with user and department info, grouped by user for today
    // We'll aggregate hours per user per day
    const usersWithLogs = await prisma.d_tbluser.findMany({
      where: {
        ...departmentFilter,
        D_tbltime_log_D_tbltime_log_user_idToD_tbluser: {
          some: {
            log_date: {
              gte: todayStart,
              lte: todayEnd,
            },
          },
        },
      },
      select: {
        user_id: true,
        first_name: true,
        last_name: true,
        D_tbldepartment: {
          select: { dept_name: true },
        },
        D_tbltime_log_D_tbltime_log_user_idToD_tbluser: {
          where: {
            log_date: {
              gte: todayStart,
              lte: todayEnd,
            },
          },
          select: { total_hours: true },
        },
      },
      skip,
      take: limit,
      orderBy: { user_id: "asc" },
    });

    // Count total for pagination
    const totalCount = await prisma.d_tbluser.count({
      where: {
        ...departmentFilter,
        D_tbltime_log_D_tbltime_log_user_idToD_tbluser: {
          some: {
            log_date: {
              gte: todayStart,
              lte: todayEnd,
            },
          },
        },
      },
    });

    // Transform data
    const logs = usersWithLogs.map((u, idx) => {
      const totalHours = u.D_tbltime_log_D_tbltime_log_user_idToD_tbluser.reduce(
        (sum, log) => sum + (log.total_hours?.toNumber() || 0),
        0
      );

      return {
        id: String(skip + idx + 1).padStart(3, "0"),
        userName: `${u.first_name || ""} ${u.last_name || ""}`.trim() || u.user_id,
        department: u.D_tbldepartment?.dept_name || "Unassigned",
        hoursLogged: Math.round(totalHours * 100) / 100,
        status: getStatusFromHours(totalHours),
      };
    });

    return NextResponse.json({
      success: true,
      data: logs,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("Analyst logs error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch logs" },
      { status: 500 }
    );
  }
}
