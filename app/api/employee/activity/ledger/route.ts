// app/api/employee/activity/ledger/route.ts
import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// TIMEZONE FIX: Helper to normalize date to start of day (00:00:00) in UTC
function startOfDay(d: Date) {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
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

    const now = new Date();
    const shiftDate = startOfDay(now);

    // Find the active shift
    const activeShift = await prisma.d_tblclock_log.findFirst({
      where: {
        user_id: user.user_id,
        shift_date: shiftDate,
        clock_out_time: null,
      },
    });

    if (!activeShift) {
      return NextResponse.json({
        activities: [],
        clockInTime: null,
      });
    }

    // Get all activities for this shift
    const activities = await prisma.d_tbltime_log.findMany({
      where: {
        user_id: user.user_id,
        clock_id: activeShift.clock_id,
      },
      include: {
        D_tblactivity: {
          select: {
            activity_code: true,
            activity_name: true,
            is_billable: true,
          },
        },
      },
      orderBy: { tlog_id: "asc" },
    });

    const formattedActivities = activities.map((act) => ({
      tlog_id: act.tlog_id,
      activity_code: act.D_tblactivity?.activity_code ?? "---",
      activity_name: act.D_tblactivity?.activity_name ?? "Unknown Activity",
      is_billable: act.D_tblactivity?.is_billable ?? false,
      start_time: act.start_time ? formatTimeHHMMSS(act.start_time) : null,
      end_time: act.end_time ? formatTimeHHMMSS(act.end_time) : null,
      total_hours: act.total_hours ? Number(act.total_hours) : null,
      log_date: act.log_date,
    }));

    return NextResponse.json({
      activities: formattedActivities,
      clockInTime: activeShift.clock_in_time
        ? activeShift.clock_in_time.toISOString()
        : null,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      }
    });
  } catch (error) {
    console.error("Get activity ledger error:", error);
    return NextResponse.json(
      { message: "Failed to get activity ledger" },
      { status: 500 }
    );
  }
}
