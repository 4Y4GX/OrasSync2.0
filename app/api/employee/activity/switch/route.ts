// app/api/employee/activity/switch/route.ts
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

    const body = await request.json();
    const { activity_id } = body;

    if (!activity_id) {
      return NextResponse.json({ message: "Activity ID is required" }, { status: 400 });
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
        { message: "You must be clocked in to switch activities" },
        { status: 400 }
      );
    }

    // Find and end the current active activity
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
        { message: "No active activity found to switch from" },
        { status: 400 }
      );
    }

    // End current activity
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

    // Get user's current department and supervisor
    const userDetails = await prisma.d_tbluser.findUnique({
      where: { user_id: user.user_id },
      select: {
        dept_id: true,
        supervisor_id: true,
      },
    });

    // Start new activity
    const newActivity = await prisma.d_tbltime_log.create({
      data: {
        user_id: user.user_id,
        activity_id: parseInt(activity_id),
        log_date: shiftDate,
        start_time: currentTime.toTimeString().split(' ')[0],
        end_time: null,
        total_hours: null,
        dept_id_at_log: userDetails?.dept_id || 0,
        supervisor_id_at_log: userDetails?.supervisor_id || '',
        approval_status: "PENDING",
        clock_id: activeShift.clock_id,
        shift_date: shiftDate,
      },
    });

    // Get activity details
    const oldActivity = await prisma.d_tblactivity.findUnique({
      where: { activity_id: activeActivity.activity_id },
    });

    const newActivityDetails = await prisma.d_tblactivity.findUnique({
      where: { activity_id: parseInt(activity_id) },
    });

    return NextResponse.json({
      message: "Activity switched successfully",
      old_activity: {
        activity_name: oldActivity?.activity_name,
        total_hours: Math.round(totalHours * 100) / 100,
      },
      new_activity: {
        tlog_id: newActivity.tlog_id,
        activity_name: newActivityDetails?.activity_name,
        activity_code: newActivityDetails?.activity_code,
        is_billable: newActivityDetails?.is_billable,
        start_time: newActivity.start_time,
      },
    });
  } catch (error) {
    console.error("Switch activity error:", error);
    return NextResponse.json(
      { message: "Failed to switch activity" },
      { status: 500 }
    );
  }
}
