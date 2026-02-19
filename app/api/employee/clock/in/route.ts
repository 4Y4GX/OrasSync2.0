import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromCookie } from "@/lib/auth";
import { getTodayShiftForUser } from "@/lib/schedule";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export async function POST() {
  const user = await getUserFromCookie();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  // BRD: cannot clock in without schedule (only applies to employees, role_id = 1)
  const scheduleToday = await getTodayShiftForUser(user.user_id);
  const isEmployee = user.role_id === 1;
  if (isEmployee && !scheduleToday.hasSchedule) {
    return NextResponse.json(
      {
        message:
          "No schedule today. Clock-in is disabled until a schedule is uploaded.",
      },
      { status: 400 }
    );
  }

  const now = new Date();
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
