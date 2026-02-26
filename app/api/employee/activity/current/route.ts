import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0; // Extra cache busting

export async function GET() {
  try {
    const user = await getUserFromCookie();
    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const activeShift = await prisma.d_tblclock_log.findFirst({
      where: {
        user_id: user.user_id,
        clock_out_time: null,
      },
      orderBy: { clock_in_time: "desc" },
    });

    if (!activeShift) {
      return NextResponse.json({ hasActiveActivity: false, currentActivity: null });
    }

    const activeActivity = await prisma.d_tbltime_log.findFirst({
      where: {
        user_id: user.user_id,
        clock_id: activeShift.clock_id,
        end_time: null,
      },
      include: { D_tblactivity: true },
      orderBy: { tlog_id: "desc" },
    });

    if (!activeActivity) {
      return NextResponse.json({ hasActiveActivity: false, currentActivity: null });
    }

    // 🚨 FIX: Extract strictly formatted HH:MM:SS from Prisma Date object
    let startTimeStr = "00:00:00";
    if (activeActivity.start_time) {
      const d = new Date(activeActivity.start_time);
      startTimeStr = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}:${String(d.getUTCSeconds()).padStart(2, '0')}`;
    }

    // Return with aggressive cache-killing headers
    return NextResponse.json({
      hasActiveActivity: true,
      currentActivity: {
        tlog_id: activeActivity.tlog_id,
        activity_id: activeActivity.activity_id,
        activity_name: activeActivity.D_tblactivity?.activity_name,
        activity_code: activeActivity.D_tblactivity?.activity_code,
        is_billable: activeActivity.D_tblactivity?.is_billable,
        start_time: startTimeStr, 
        log_date: activeActivity.log_date,
      },
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
  } catch (error) {
    console.error("Get current activity error:", error);
    return NextResponse.json(
      { message: "Failed to get current activity" },
      { status: 500 }
    );
  }
}