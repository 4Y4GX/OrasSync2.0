// app/api/employee/activity/ledger/route.ts
import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { combineShiftDateWithTime } from "@/lib/timezone";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getUserFromCookie();
    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Get the current active clock log
    const activeShift = await prisma.d_tblclock_log.findFirst({
      where: {
        user_id: user.user_id,
        clock_out_time: null,
      },
      orderBy: { clock_in_time: "desc" },
    });

    if (!activeShift) {
      return NextResponse.json({
        ledger: [],
        message: "Not clocked in today"
      });
    }

    // Get ALL clock logs for the same shift_date (includes previous sessions if clocked out early and back in)
    const allClockLogs = await prisma.d_tblclock_log.findMany({
      where: {
        user_id: user.user_id,
        shift_date: activeShift.shift_date,
      },
      orderBy: { clock_in_time: "asc" },
    });

    const allClockIds = allClockLogs.map(log => log.clock_id);

    // Get all activity logs for ALL clock sessions on this shift
    const activityLogs = await prisma.d_tbltime_log.findMany({
      where: {
        user_id: user.user_id,
        clock_id: { in: allClockIds },
      },
      include: {
        D_tblactivity: true,
      },
      orderBy: {
        start_time: "desc", // Newest first
      },
    });

    // Get the first clock-in time for reference (used to detect overnight shifts)
    const firstClockIn = allClockLogs[0]?.clock_in_time ?? new Date();

    // Format the ledger data with proper full datetime for sorting
    const ledger: any[] = activityLogs.map((log) => {
      const fullStartTime = combineShiftDateWithTime(log.start_time, activeShift.shift_date!, firstClockIn);
      const fullEndTime = log.end_time ? combineShiftDateWithTime(log.end_time, activeShift.shift_date!, firstClockIn) : null;
      
      return {
        tlog_id: log.tlog_id,
        activity_code: log.D_tblactivity?.activity_code || "???",
        activity_name: log.D_tblactivity?.activity_name || "Unknown Activity",
        is_billable: log.D_tblactivity?.is_billable || false,
        start_time: fullStartTime,
        end_time: fullEndTime || "…", // Show "…" if still active
        total_hours: log.total_hours,
        is_active: log.end_time === null,
      };
    });

    // Add clock session entries (clock in with end time being clock out)
    allClockLogs.forEach((clockLog, index) => {
      const isCurrentSession = clockLog.clock_out_time === null;
      ledger.push({
        tlog_id: -clockLog.clock_id, // Negative to avoid collision with activity tlog_ids
        activity_code: "CLK",
        activity_name: allClockLogs.length > 1 ? `Session #${index + 1}` : "Clock In",
        is_billable: false,
        start_time: clockLog.clock_in_time,
        end_time: clockLog.clock_out_time || (isCurrentSession ? "…" : "—"), // Show clock out time or "…" if still active
        total_hours: null,
        is_active: isCurrentSession,
      });
    });

    // Sort all entries by start_time descending (newest first)
    ledger.sort((a, b) => {
      const timeA = new Date(a.start_time).getTime();
      const timeB = new Date(b.start_time).getTime();
      return timeB - timeA;
    });

    return NextResponse.json({
      ledger,
      clock_in_time: firstClockIn,
    });
  } catch (error) {
    console.error("Get activity ledger error:", error);
    return NextResponse.json(
      { message: "Failed to get activity ledger" },
      { status: 500 }
    );
  }
}