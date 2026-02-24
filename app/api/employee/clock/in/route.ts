import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromCookie } from "@/lib/auth";
import { getTodayShiftForUser } from "@/lib/schedule";
import { getNowInTimezone, getTodayInTimezone } from "@/lib/timezone";

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

  // Use fixed Asia/Manila timezone (server-enforced, cannot be manipulated by client)
  const now = getNowInTimezone();
  const shiftDate = getTodayInTimezone();

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
        active_key: "ACTIVE",
      },
      select: { clock_id: true, clock_in_time: true, shift_date: true },
    });

    // --- Streak update logic for employees ---
    if (isEmployee) {
      // Get or create user stats
      let userStats = await prisma.d_tbluser_stats.findUnique({
        where: { user_id: user.user_id },
      });
      let lastAttendance = userStats?.last_attendance;
      if (!userStats) {
        userStats = await prisma.d_tbluser_stats.create({
          data: {
            user_id: user.user_id,
            streak_count: 1,
            total_absences: 0,
            last_attendance: now,
          },
        });
      } else {
        // Calculate absences and streak based on scheduled workdays
        let streak = 1;
        let absences = userStats.total_absences || 0;
        let prevDate = lastAttendance ? new Date(lastAttendance) : null;
        const today = new Date(shiftDate);
        // Only check if last attendance is before today
        if (prevDate && prevDate < today) {
          // Get user's weekly schedule
          const weekly = await prisma.d_tblweekly_schedule.findFirst({
            where: { user_id: user.user_id, is_active: true },
            select: {
              monday_shift_id: true,
              tuesday_shift_id: true,
              wednesday_shift_id: true,
              thursday_shift_id: true,
              friday_shift_id: true,
              saturday_shift_id: true,
              sunday_shift_id: true,
            },
          });
          if (weekly) {
            let missed = false;
            let d = new Date(prevDate);
            d.setDate(d.getDate() + 1);
            while (d <= today) {
              const weekday = d.getDay();
              const shiftId =
                weekday === 0 ? weekly.sunday_shift_id :
                weekday === 1 ? weekly.monday_shift_id :
                weekday === 2 ? weekly.tuesday_shift_id :
                weekday === 3 ? weekly.wednesday_shift_id :
                weekday === 4 ? weekly.thursday_shift_id :
                weekday === 5 ? weekly.friday_shift_id :
                weekly.saturday_shift_id;
              if (shiftId) {
                // Scheduled workday
                const clock = await prisma.d_tblclock_log.findFirst({
                  where: {
                    user_id: user.user_id,
                    shift_date: d,
                  },
                });
                if (!clock && d < today) {
                  absences++;
                  missed = true;
                } else if (!clock && d.getTime() === today.getTime()) {
                  // today, just clocked in
                  // do not count as absence
                } else if (clock && !missed) {
                  streak++;
                } else if (clock && missed) {
                  streak = 1;
                  missed = false;
                }
              }
              d.setDate(d.getDate() + 1);
            }
          }
        }
        await prisma.d_tbluser_stats.update({
          where: { user_id: user.user_id },
          data: { streak_count: streak, total_absences: absences, last_attendance: now },
        });
      }
    }

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
