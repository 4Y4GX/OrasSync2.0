// app/api/employee/activity/current/route.ts
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

    // Check if user is clocked in (don't filter by shift_date to avoid timezone issues)
    const activeShift = await prisma.d_tblclock_log.findFirst({
      where: {
        user_id: user.user_id,
        clock_out_time: null,
      },
      orderBy: { clock_in_time: "desc" },
    });

    if (!activeShift) {
      return NextResponse.json({
        hasActiveActivity: false,
        currentActivity: null,
      });
    }

    // Find the current active activity
    const activeActivity = await prisma.d_tbltime_log.findFirst({
      where: {
        user_id: user.user_id,
        clock_id: activeShift.clock_id,
        end_time: null,
      },
      include: {
        D_tblactivity: true,
      },
      orderBy: { tlog_id: "desc" },
    });

    if (!activeActivity) {
      return NextResponse.json({
        hasActiveActivity: false,
        currentActivity: null,
      });
    }

    return NextResponse.json({
      hasActiveActivity: true,
      currentActivity: {
        tlog_id: activeActivity.tlog_id,
        activity_id: activeActivity.activity_id,
        activity_name: activeActivity.D_tblactivity?.activity_name,
        activity_code: activeActivity.D_tblactivity?.activity_code,
        is_billable: activeActivity.D_tblactivity?.is_billable,
        start_time: activeActivity.start_time,
        log_date: activeActivity.log_date,
      },
    });
  } catch (error) {
    console.error("Get current activity error:", error);
    return NextResponse.json(
      { message: "Failed to get current activity" },
      { status: 500 }
    );
  }
}
