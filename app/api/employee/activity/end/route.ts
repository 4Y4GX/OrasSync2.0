// app/api/employee/activity/end/route.ts
import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await getUserFromCookie();
    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Get current date in local timezone
    const now = new Date();
    const shiftDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

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
    const startTime = new Date(`${shiftDate.toISOString().split('T')[0]}T${activeActivity.start_time}`);
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
    const activity = await prisma.d_tblactivity.findUnique({
      where: { activity_id: activeActivity.activity_id },
    });

    return NextResponse.json({
      message: "Activity ended successfully",
      activity: {
        tlog_id: activeActivity.tlog_id,
        activity_name: activity?.activity_name,
        activity_code: activity?.activity_code,
        total_hours: Math.round(totalHours * 100) / 100,
        start_time: activeActivity.start_time,
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
