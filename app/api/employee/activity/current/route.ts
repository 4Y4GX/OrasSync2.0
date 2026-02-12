// app/api/employee/activity/current/route.ts
import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatTimeHHMM } from "@/lib/schedule";

export const dynamic = "force-dynamic";

// TIMEZONE FIX: Helper to normalize date to start of day (00:00:00)
// This must match the logic used in clock/in/route.ts and activity/start/route.ts
// to ensure shift_date queries work correctly regardless of user timezone
function startOfDay(d: Date) {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0); // Use UTC to avoid timezone issues
  return x;
}

// Helper to format TIME field with seconds
function formatTimeHHMMSS(timeDate: Date): string {
  const hh = timeDate.getUTCHours().toString().padStart(2, "0");
  const mm = timeDate.getUTCMinutes().toString().padStart(2, "0");
  const ss = timeDate.getUTCSeconds().toString().padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export async function GET() {
  try {
    const user = await getUserFromCookie();
    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Get current date in local timezone
    const now = new Date();
    // TIMEZONE FIX: Use consistent startOfDay logic as clock-in endpoint
    // Previous code: new Date(now.getFullYear(), now.getMonth(), now.getDate())
    // Issue: Device timezone caused mismatch when querying d_tblclock_log
    const shiftDate = startOfDay(now);

    // Check if user is clocked in
    const activeShift = await prisma.d_tblclock_log.findFirst({
      where: {
        user_id: user.user_id,
        shift_date: shiftDate,
        clock_out_time: null,
      },
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
        start_time: activeActivity.start_time ? formatTimeHHMMSS(activeActivity.start_time) : "00:00:00",
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
