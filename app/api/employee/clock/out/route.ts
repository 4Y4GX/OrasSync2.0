import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromCookie } from "@/lib/auth";
import { getTodayShiftForUser } from "@/lib/schedule";
import { getNowInTimezone } from "@/lib/timezone";

// Stronger emoji blocking
const EMOJI_LIKE = /[\p{Extended_Pictographic}\uFE0F\u200D]/gu;

// Allowed only letters/space/./,
const ALLOWED_REASON_CHARS = /^[A-Za-z .,]*$/;

function validateReason(reason: string) {
  const r = reason.trim();
  if (!r) return "Reason required";
  if (EMOJI_LIKE.test(r)) return "No emojis allowed";
  if (r.length > 180) return "Reason too long (max 180 chars)";
  if (!ALLOWED_REASON_CHARS.test(r)) return "Only letters, spaces, . and , are allowed";
  return null;
}


function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export async function POST(req: Request) {
  const user = await getUserFromCookie();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const reason = String(body?.reason ?? "");

  // Find active shift (source of truth)
  const active = await prisma.d_tblclock_log.findFirst({
    where: {
      user_id: user.user_id,
      clock_out_time: null,
    },
    orderBy: { clock_in_time: "desc" },
    select: { clock_id: true, shift_date: true, clock_in_time: true },
  });

  if (!active) {
    return NextResponse.json({ message: "No active shift" }, { status: 400 });
  }

  // Use fixed Asia/Manila timezone (server-enforced, cannot be manipulated by client)
  const now = getNowInTimezone();
  const scheduleToday = await getTodayShiftForUser(user.user_id);

  // If no schedule exists, allow clock-out without early reason
  if (!scheduleToday.hasSchedule || !scheduleToday.shift?.end_time) {
    // ✅ Race-safe: only update if still not clocked out
    const result = await prisma.d_tblclock_log.updateMany({
      where: { clock_id: active.clock_id, clock_out_time: null },
      data: {
        clock_out_time: now,
        is_early_leave: false,
        active_key: null, // release active lock
      },
    });

    if (result.count === 0) {
      return NextResponse.json({
        message: "Already clocked out",
        isEarly: false,
        scheduleToday,
      });
    }

    return NextResponse.json({
      message: "Clock out successful",
      isEarly: false,
      scheduleToday,
    });
  }

  const scheduledEnd = new Date(scheduleToday.shift.end_time);
  const isEarly = now.getTime() < scheduledEnd.getTime();

  // Early clock-out requires a reason (strict allowed chars)
  if (isEarly) {
    const err = validateReason(reason);
    if (err) return NextResponse.json({ message: err }, { status: 400 });
  }

  // ✅ Race-safe clock out update (idempotent)
  const updated = await prisma.d_tblclock_log.updateMany({
    where: { clock_id: active.clock_id, clock_out_time: null },
    data: {
      clock_out_time: now,
      is_early_leave: isEarly,
      active_key: null,
    },
  });

  if (updated.count === 0) {
    return NextResponse.json({
      message: "Already clocked out",
      isEarly,
      scheduleToday,
    });
  }

  // Save early reason safely (avoid duplicates for same day)
  if (isEarly) {
    const shiftDateBase = active.shift_date ? new Date(active.shift_date) : now;
    const dayStart = startOfDay(shiftDateBase);
    const dayEnd = endOfDay(shiftDateBase);

    const existing = await prisma.d_tblearly_reasonlog.findFirst({
      where: {
        user_id: user.user_id,
        shift_date: { gte: dayStart, lte: dayEnd },
      },
      orderBy: { reasonlog_id: "desc" },
      select: { reasonlog_id: true },
    });

    if (existing?.reasonlog_id) {
      await prisma.d_tblearly_reasonlog.update({
        where: { reasonlog_id: existing.reasonlog_id },
        data: {
          shift_date: shiftDateBase,
          reason: reason.trim(),
        },
      });
    } else {
      await prisma.d_tblearly_reasonlog.create({
        data: {
          user_id: user.user_id,
          shift_date: shiftDateBase,
          reason: reason.trim(),
        },
      });
    }
  }

  return NextResponse.json({
    message: "Clock out successful",
    isEarly,
    scheduleToday,
  });
}
