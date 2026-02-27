import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { combineShiftDateWithTime } from "@/lib/timezone";

export const dynamic = "force-dynamic";
export const revalidate = 0; // Kills Next.js caching

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

    // Get ALL clock logs for the same shift_date
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
    });

    const firstClockIn = allClockLogs[0]?.clock_in_time ?? new Date();

    // Format the ledger data
    const ledger: any[] = activityLogs.map((log) => {
      // Safely type-check to prevent TypeScript build errors
      const st = log.start_time && activeShift.shift_date
        ? combineShiftDateWithTime(log.start_time, activeShift.shift_date, firstClockIn)
        : new Date();
        
      const et = log.end_time && activeShift.shift_date
        ? combineShiftDateWithTime(log.end_time, activeShift.shift_date, firstClockIn)
        : null;
      
      return {
        tlog_id: log.tlog_id,
        activity_code: log.D_tblactivity?.activity_code || "???",
        activity_name: log.D_tblactivity?.activity_name || "Unknown Activity",
        is_billable: log.D_tblactivity?.is_billable || false,
        start_time: st,
        end_time: et || "…",
        total_hours: log.total_hours,
        is_active: log.end_time === null,
      };
    });

    // Add clock session entries
    allClockLogs.forEach((clockLog, index) => {
      const isCurrentSession = clockLog.clock_out_time === null;
      ledger.push({
        tlog_id: -clockLog.clock_id, // Negative to avoid collision with activity tlog_ids
        activity_code: "CLK",
        activity_name: allClockLogs.length > 1 ? `Session #${index + 1}` : "Clock In",
        is_billable: false,
        start_time: clockLog.clock_in_time || new Date(),
        end_time: clockLog.clock_out_time || (isCurrentSession ? "…" : "—"),
        total_hours: null,
        // Only tag as active if there are no running tasks
        is_active: isCurrentSession && !ledger.some(l => l.is_active && l.activity_code !== "CLK"),
      });
    });

    // 🚨 THE FIX: BULLETPROOF SORTING
    ledger.sort((a, b) => {
      // 1. Force the currently active task to be pinned to the absolute top
      if (a.is_active && !b.is_active) return -1;
      if (!a.is_active && b.is_active) return 1;
      
      // 2. Sort everything else purely by database Primary Key (tlog_id) descending.
      // Database ID always increments upwards, meaning the newest item is mathematically guaranteed to be on top.
      return b.tlog_id - a.tlog_id;
    });

    return NextResponse.json({
      ledger,
      clock_in_time: firstClockIn,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
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