// app/api/employee/activity/end/route.ts
import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getNowInTimezone, getTimeForStorage } from "@/lib/timezone";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await getUserFromCookie();
    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Use fixed Asia/Manila timezone (server-enforced, cannot be manipulated by client)
    const now = getNowInTimezone();
    const timeForStorage = getTimeForStorage();

    // Check if user is clocked in (don't filter by shift_date to avoid timezone issues)
    const activeShift = await prisma.d_tblclock_log.findFirst({
      where: {
        user_id: user.user_id,
        clock_out_time: null,
      },
      orderBy: { clock_in_time: "desc" },
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
    // activeActivity.start_time is a Date from TIME(0) - extract time and combine with shift date
    const st = activeActivity.start_time as Date;
    const shiftDate = activeShift.shift_date!;
    const startTime = new Date(
      shiftDate.getFullYear(),
      shiftDate.getMonth(),
      shiftDate.getDate(),
      st.getUTCHours(),
      st.getUTCMinutes(),
      st.getUTCSeconds()
    );
    const durationMs = now.getTime() - startTime.getTime();
    const totalHours = durationMs / (1000 * 60 * 60);

    await prisma.d_tbltime_log.update({
      where: { tlog_id: activeActivity.tlog_id },
      data: {
        end_time: timeForStorage,
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
        start_time: activeActivity.start_time,
        end_time: now.toTimeString().split(' ')[0],
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