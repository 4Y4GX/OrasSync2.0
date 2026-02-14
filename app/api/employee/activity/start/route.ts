// app/api/employee/activity/start/route.ts
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

    const body = await request.json();
    const { activity_id } = body;

    if (!activity_id) {
      return NextResponse.json({ message: "Activity ID is required" }, { status: 400 });
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
        { message: "You must be clocked in to start an activity" },
        { status: 400 }
      );
    }

    // Check if there's an active activity (no end_time)
    const activeActivity = await prisma.d_tbltime_log.findFirst({
      where: {
        user_id: user.user_id,
        clock_id: activeShift.clock_id,
        end_time: null,
      },
      orderBy: { tlog_id: "desc" },
    });

    // If there's an active activity, end it first
    if (activeActivity) {
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
    }

    // Get user's current department and supervisor
    const userDetails = await prisma.d_tbluser.findUnique({
      where: { user_id: user.user_id },
      select: {
        dept_id: true,
        supervisor_id: true,
      },
    });

    // Create new activity log
    const newActivity = await prisma.d_tbltime_log.create({
      data: {
        user_id: user.user_id,
        activity_id: parseInt(activity_id),
        log_date: activeShift.shift_date!,
        start_time: timeForStorage,
        end_time: null,
        total_hours: null,
        dept_id_at_log: userDetails?.dept_id || 0,
        supervisor_id_at_log: userDetails?.supervisor_id || '',
        approval_status: "PENDING",
        clock_id: activeShift.clock_id,
        shift_date: activeShift.shift_date!,
      },
    });

    // Get activity details
    const activity = await prisma.d_tblactivity.findUnique({
      where: { activity_id: parseInt(activity_id) },
    });

    return NextResponse.json({
      message: "Activity started successfully",
      activity: {
        tlog_id: newActivity.tlog_id,
        activity_name: activity?.activity_name,
        activity_code: activity?.activity_code,
        is_billable: activity?.is_billable,
        start_time: newActivity.start_time,
      },
    });
  } catch (error) {
    console.error("Start activity error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { message: "Failed to start activity", error: errorMessage },
      { status: 500 }
    );
  }
}