import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getTimeForStorage, calculateDurationMs } from "@/lib/timezone";

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

    const timeForStorage = getTimeForStorage();

    const activeShift = await prisma.d_tblclock_log.findFirst({
      where: {
        user_id: user.user_id,
        clock_out_time: null,
      },
      orderBy: { clock_in_time: "desc" },
    });

    if (!activeShift) {
      return NextResponse.json(
        { message: "You must be clocked in to switch activities" },
        { status: 400 }
      );
    }

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

    const st = activeActivity.start_time as Date;
    const shiftDate = activeShift.shift_date!;
    
    const durationMs = calculateDurationMs(shiftDate, st);
    const totalHours = isNaN(durationMs) ? 0 : durationMs / (1000 * 60 * 60);

    await prisma.d_tbltime_log.update({
      where: { tlog_id: activeActivity.tlog_id },
      data: {
        end_time: timeForStorage,
        total_hours: Math.round(totalHours * 100) / 100,
      },
    });

    const userDetails = await prisma.d_tbluser.findUnique({
      where: { user_id: user.user_id },
      select: { dept_id: true, supervisor_id: true, manager_id: true },
    });

    const newActivity = await prisma.d_tbltime_log.create({
      data: {
        user_id: user.user_id,
        activity_id: parseInt(activity_id),
        log_date: activeShift.shift_date!,
        start_time: timeForStorage,
        end_time: null,
        total_hours: null,
        dept_id_at_log: userDetails?.dept_id || null,
        supervisor_id: userDetails?.supervisor_id || null,
        manager_id: userDetails?.manager_id || null,
        supervisor_id_at_log: userDetails?.supervisor_id || null,
        // ✅ FIX: Force the starting state to be NOT_SUBMITTED
        approval_status: "NOT_SUBMITTED",
        clock_id: activeShift.clock_id,
        shift_date: activeShift.shift_date!,
      },
    });

    const newActivityDetails = await prisma.d_tblactivity.findUnique({
      where: { activity_id: parseInt(activity_id) },
    });

    return NextResponse.json({
      message: "Activity switched successfully",
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