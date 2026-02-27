import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromCookie } from "@/lib/auth";
import { getTodayShiftForUser } from "@/lib/schedule";
import { getNowInTimezone, getTimeForStorage, calculateDurationMs } from "@/lib/timezone";

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
  try {
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

    // Use fixed timezone utilities
    const now = getNowInTimezone();
    const timeForStorage = getTimeForStorage();
    const scheduleToday = await getTodayShiftForUser(user.user_id);
    
    let isEarly = false;

    // Check if early clock out applies
    if (scheduleToday.hasSchedule && scheduleToday.shift?.end_time) {
      const scheduledEnd = new Date(scheduleToday.shift.end_time);
      isEarly = now.getTime() < scheduledEnd.getTime();

      if (isEarly) {
        const err = validateReason(reason);
        if (err) return NextResponse.json({ message: err }, { status: 400 });
      }
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
        isEarly: false,
        scheduleToday,
      });
    }

    // Save early reason safely
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
          data: { shift_date: shiftDateBase, reason: reason.trim() },
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

    // 🚨 THE FIX: Auto-end active task safely using the timezone utilities to prevent 490,000 hour calculations
    const activeTask = await prisma.d_tbltime_log.findFirst({
      where: { clock_id: active.clock_id, end_time: null },
      orderBy: { tlog_id: "desc" }
    });

    if (activeTask && activeTask.start_time && active.shift_date) {
      const st = activeTask.start_time as Date;
      const durationMs = calculateDurationMs(active.shift_date, st);
      const totalHours = isNaN(durationMs) ? 0 : Math.max(0, durationMs / (1000 * 60 * 60));

      await prisma.d_tbltime_log.update({
        where: { tlog_id: activeTask.tlog_id },
        data: {
          end_time: timeForStorage, 
          total_hours: Math.round(totalHours * 100) / 100,
        },
      });
    }

    return NextResponse.json({
      message: "Clock out successful",
      isEarly,
      scheduleToday,
    });
  } catch (error) {
    console.error("Clock out error:", error);
    return NextResponse.json({ message: "Failed to clock out" }, { status: 500 });
  }
}