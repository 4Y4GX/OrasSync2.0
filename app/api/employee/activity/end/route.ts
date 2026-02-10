// app/api/employee/activity/end/route.ts
import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// TIMEZONE FIX: Helper to normalize date to start of day (00:00:00)
// This must match the logic used in clock/in/route.ts and activity/start/route.ts
// to ensure shift_date queries work correctly regardless of user timezone
function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// Helper to format TIME field with seconds
function formatTimeHHMMSS(timeDate: Date): string {
  const hh = timeDate.getUTCHours().toString().padStart(2, "0");
  const mm = timeDate.getUTCMinutes().toString().padStart(2, "0");
  const ss = timeDate.getUTCSeconds().toString().padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export async function POST(request: Request) {
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
      return NextResponse.json(
        { message: "You must be clocked in to end an activity" },
        { status: 400 }
      );
    }

    // Find the current active activity
    const activeActivity = await prisma.d_tbltime_log.findFirst({
      where: {
        user_id: user.user_id,
        clock_id: activeShift.clock_id,
        end_time: null,
      },
      orderBy: { tlog_id: "desc" },
    });

    if (!activeActivity) {
      return NextResponse.json(
        { message: "No active activity found to end" },
        { status: 400 }
      );
    }

    // End the activity
    const currentTime = new Date();
    const timeStr = activeActivity.start_time ? formatTimeHHMMSS(activeActivity.start_time) : "00:00:00";
    const startTime = new Date(`${shiftDate.toISOString().split('T')[0]}T${timeStr}`);
    const durationMs = currentTime.getTime() - startTime.getTime();
    const totalHours = durationMs / (1000 * 60 * 60);

    await prisma.d_tbltime_log.update({
      where: { tlog_id: activeActivity.tlog_id },
      data: {
        end_time: currentTime.toTimeString().split(' ')[0],
        total_hours: Math.round(totalHours * 100) / 100,
      },
    });

     // Get activity details
    const activity = activeActivity.activity_id
      ? await prisma.d_tblactivity.findUnique({
        where: { activity_id: activeActivity.activity_id },
      })
      : null;

    return NextResponse.json({
      message: "Activity ended successfully",
      activity: {
        tlog_id: activeActivity.tlog_id,
        activity_name: activity?.activity_name,
        activity_code: activity?.activity_code,
        total_hours: Math.round(totalHours * 100) / 100,
        start_time: typeof activeActivity.start_time === 'string' ? activeActivity.start_time : (activeActivity.start_time ? formatTimeHHMMSS(activeActivity.start_time) : "00:00:00"),
        end_time: currentTime.toTimeString().split(' ')[0],
      },
    });
  } catch (error) {
    console.error("End activity error:", error);
    return NextResponse.json(
      { message: "Failed to end activity" },
      { status: 500 }
    );
  }
}