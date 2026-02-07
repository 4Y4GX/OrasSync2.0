import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromCookie } from "@/lib/auth";
import { getTodayShiftForUser } from "@/lib/schedule";

export async function GET() {
  const sessionUser = await getUserFromCookie();
  if (!sessionUser) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const userId = sessionUser.user_id;

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

  const scheduleToday = await getTodayShiftForUser(userId);

  // Real user info (name / dept / team / position + streak_count)
  const userProfile = await prisma.d_tbluser.findFirst({
    where: { user_id: userId },
    select: {
      user_id: true,
      first_name: true,
      last_name: true,
      streak_count: true, // ✅ add this
      D_tbldepartment: { select: { dept_name: true } },
      D_tblteam: { select: { team_name: true } },
      D_tblposition: { select: { pos_name: true } },
    },
  });

  const first = (userProfile?.first_name ?? "").toString().trim();
  const last = (userProfile?.last_name ?? "").toString().trim();
  const fullName = `${first}${last ? ` ${last}` : ""}`.trim() || null;

  const dept = userProfile?.D_tbldepartment?.dept_name ?? null;
  const team = userProfile?.D_tblteam?.team_name ?? null;
  const position = userProfile?.D_tblposition?.pos_name ?? null;

  return NextResponse.json({
    isClockedIn: !!activeShift,
    activeShift,
    scheduleToday,

    userProfile: {
      user_id: userId,
      name: fullName,
      first_name: userProfile?.first_name ?? null,
      last_name: userProfile?.last_name ?? null,
      dept_name: dept,
      team_name: team,
      pos_name: position,
      streak_count: userProfile?.streak_count ?? 0, // ✅ include in response
    },
  });
}
