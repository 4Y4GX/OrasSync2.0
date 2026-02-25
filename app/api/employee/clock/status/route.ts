import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromCookie } from "@/lib/auth";
import { getTodayShiftForUser } from "@/lib/schedule";
import { getTodayInTimezone } from "@/lib/timezone";

export async function GET() {
  const sessionUser = await getUserFromCookie();
  if (!sessionUser) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const userId = sessionUser.user_id;

  // Get today's date for shift matching
  const todayShiftDate = getTodayInTimezone();
  const todayStart = new Date(todayShiftDate);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayShiftDate);
  todayEnd.setHours(23, 59, 59, 999);

  const activeShift = await prisma.d_tblclock_log.findFirst({
    where: {
      user_id: userId,
      clock_out_time: null,
    },
    orderBy: { clock_in_time: "desc" },
    select: {
      clock_id: true,
      user_id: true,
      shift_date: true,
      clock_in_time: true,
      clock_out_time: true,
      is_early_leave: true,
      is_sentiment_done: true,
    },
  });

  // Calculate accumulated worked time for today's shift (completed sessions)
  const completedSessions = await prisma.d_tblclock_log.findMany({
    where: {
      user_id: userId,
      shift_date: {
        gte: todayStart,
        lte: todayEnd,
      },
      clock_out_time: { not: null }, // Only completed sessions
    },
    select: {
      clock_in_time: true,
      clock_out_time: true,
    },
  });

  // Sum up all completed session durations in milliseconds
  let accumulatedMs = 0;
  for (const session of completedSessions) {
    if (session.clock_in_time && session.clock_out_time) {
      const inTime = new Date(session.clock_in_time).getTime();
      const outTime = new Date(session.clock_out_time).getTime();
      accumulatedMs += Math.max(0, outTime - inTime);
    }
  }

  const scheduleToday = await getTodayShiftForUser(userId);

  // Real user info (name / dept / team / position)
  const user = await prisma.d_tbluser.findFirst({
    where: { user_id: userId },
    select: {
      user_id: true,
      first_name: true,
      last_name: true,
      D_tbldepartment: { select: { dept_name: true } },
      D_tblteam: { select: { team_name: true } },
      D_tblposition: { select: { pos_name: true } },
    },
  });

  // Fetch streak_count from stats table
  let userStats = await prisma.d_tbluser_stats.findUnique({
    where: { user_id: userId },
  });
  if (!userStats) {
    userStats = await prisma.d_tbluser_stats.create({
      data: {
        user_id: userId,
        streak_count: 0,
        total_absences: 0,
      },
    });
  }

  const first = (user?.first_name ?? "").toString().trim();
  const last = (user?.last_name ?? "").toString().trim();
  const fullName = `${first}${last ? ` ${last}` : ""}`.trim() || null;

  const dept = user?.D_tbldepartment?.dept_name ?? null;
  const team = user?.D_tblteam?.team_name ?? null;
  const position = user?.D_tblposition?.pos_name ?? null;

  return NextResponse.json({
    isClockedIn: !!activeShift,
    activeShift,
    scheduleToday,
    accumulatedMs, // Total worked time from completed sessions today (in milliseconds)

    userProfile: {
      user_id: userId,
      role_id: sessionUser.role_id, // ✅ include role_id for schedule check logic
      name: fullName,
      first_name: user?.first_name ?? null,
      last_name: user?.last_name ?? null,
      dept_name: dept,
      team_name: team,
      pos_name: position,
      streak_count: userStats?.streak_count ?? 0,
    },
  });
}
