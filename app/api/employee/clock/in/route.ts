import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromCookie } from "@/lib/auth";
import { getTodayShiftForUser } from "@/lib/schedule";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0); // Use UTC to avoid timezone issues
  return x;
}

// Grace period in minutes - allows clock-in up to X minutes before shift starts
const CLOCK_IN_GRACE_PERIOD_MINUTES = 15;

export async function POST() {
  const user = await getUserFromCookie();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  // BRD: cannot clock in without schedule
  const scheduleToday = await getTodayShiftForUser(user.user_id);
  if (!scheduleToday.hasSchedule) {
    return NextResponse.json(
      {
        message:
          "No schedule today. Clock-in is disabled until a schedule is uploaded.",
      },
      { status: 400 }
    );
  }

  const now = new Date();

  // Validate that current time is within the scheduled shift time
  const shiftStart = new Date(scheduleToday.shift.start_time);
  const shiftEnd = new Date(scheduleToday.shift.end_time);

  // Allow clock-in X minutes before shift starts (grace period)
  const earliestClockIn = new Date(shiftStart.getTime() - CLOCK_IN_GRACE_PERIOD_MINUTES * 60 * 1000);

  if (now < earliestClockIn) {
    const startTimeFormatted = shiftStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return NextResponse.json(
      {
        message: `Cannot clock in yet. Your shift starts at ${startTimeFormatted}. You can clock in starting ${CLOCK_IN_GRACE_PERIOD_MINUTES} minutes before your shift.`,
      },
      { status: 400 }
    );
  }

  if (now > shiftEnd) {
    const endTimeFormatted = shiftEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return NextResponse.json(
      {
        message: `Cannot clock in. Your shift ended at ${endTimeFormatted}.`,
      },
      { status: 400 }
    );
  }
  const shiftDate = startOfDay(now);

  try {
    const created = await prisma.d_tblclock_log.create({
      data: {
        user_id: user.user_id,
        shift_date: shiftDate,
        last_log_in: now,
        clock_in_time: now,
        clock_out_time: null,
        is_sentiment_done: false,
        is_early_leave: false,

        // ✅ UNIQUE(user_id, active_key) => only one ACTIVE row per user
        active_key: "ACTIVE",
      },
      select: { clock_id: true, clock_in_time: true, shift_date: true },
    });

    return NextResponse.json({
      message: "Clock in successful",
      activeShift: created,
      scheduleToday,
    });
  } catch (err: any) {
    // Prisma unique constraint violation = P2002
    if (err?.code === "P2002") {
      const existing = await prisma.d_tblclock_log.findFirst({
        where: { user_id: user.user_id, clock_out_time: null },
        orderBy: { clock_in_time: "desc" },
        select: { clock_id: true, clock_in_time: true, shift_date: true },
      });

      return NextResponse.json({
        message: "Already clocked in",
        activeShift: existing,
        scheduleToday,
      });
    }

    console.error("CLOCK_IN_ERROR:", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
