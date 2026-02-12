// app/api/employee/activity/ledger/route.ts
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

    // Get current date in local timezone
    const now = new Date();
    const shiftDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Get today's clock log
    const activeShift = await prisma.d_tblclock_log.findFirst({
      where: {
        user_id: user.user_id,
        shift_date: shiftDate,
        clock_out_time: null,
      },
    });

    if (!activeShift) {
      return NextResponse.json({
        ledger: [],
        message: "Not clocked in today"
      });
    }

    // Get all activity logs for today's shift
    const activityLogs = await prisma.d_tbltime_log.findMany({
      where: {
        user_id: user.user_id,
        clock_id: activeShift.clock_id,
        shift_date: shiftDate,
      },
      include: {
        D_tblactivity: true,
      },
      orderBy: {
        start_time: "asc", // Oldest first
      },
    });

    // Format the ledger data
    const ledger = activityLogs.map((log) => ({
      tlog_id: log.tlog_id,
      activity_code: log.D_tblactivity?.activity_code || "???",
      activity_name: log.D_tblactivity?.activity_name || "Unknown Activity",
      is_billable: log.D_tblactivity?.is_billable || false,
      start_time: log.start_time,
      end_time: log.end_time || "…", // Show "…" if still active
      total_hours: log.total_hours,
      is_active: log.end_time === null, // Flag if this is the currently active one
    }));

    return NextResponse.json({
      ledger,
      clock_in_time: activeShift.clock_in_time,
    });
  } catch (error) {
    console.error("Get activity ledger error:", error);
    return NextResponse.json(
      { message: "Failed to get activity ledger" },
      { status: 500 }
    );
  }
}