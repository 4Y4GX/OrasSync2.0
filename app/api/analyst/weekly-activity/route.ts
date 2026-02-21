// app/api/analyst/weekly-activity/route.ts
import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const ROLE_ANALYST = 2;
const ROLE_ADMIN = 3;

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
    const currentDayIndex = today.getDay();

    // Get start of the week (Sunday)
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    weekStart.setHours(0, 0, 0, 0);

    // Build array of 7 days
    const weeklyData: Array<{ day: string; logs: number; isCurrentDay: boolean }> = [];

    for (let i = 0; i < 7; i++) {
      const dayStart = new Date(weekStart);
      dayStart.setDate(weekStart.getDate() + i);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      // Count logs for this day
      const logsCount = await prisma.d_tbltime_log.count({
        where: {
          log_date: {
            gte: dayStart,
            lte: dayEnd,
          },
        },
      });

      weeklyData.push({
        day: DAY_NAMES[i],
        logs: logsCount,
        isCurrentDay: i === currentDayIndex,
      });
    }

    return NextResponse.json({
      success: true,
      data: weeklyData,
    });
  } catch (error) {
    console.error("Weekly activity error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch weekly activity data" },
      { status: 500 }
    );
  }
}
