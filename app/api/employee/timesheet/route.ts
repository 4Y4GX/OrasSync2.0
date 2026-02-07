import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromCookie } from "@/lib/auth";

function toYMD(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseYMD(s: string | null) {
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
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

type TimesheetDay = {
  date: string;
  clocks: Array<{
    clock_id: number;
    shift_date: Date | null;
    clock_in_time: Date | null;
    clock_out_time: Date | null;
    is_early_leave: boolean;
    early_reason: string | null;
  }>;
  activities: Array<{
    tlog_id: number;
    activity_id: number | null;
    activity_name: string | null;
    start_time: Date | null;
    end_time: Date | null;
    total_hours: any;
    approval_status: any;
    rejection_reason: string | null;
  }>;
};

export async function GET(req: Request) {
  try {
    const user = await getUserFromCookie();
    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const userId = (user as any).user_id ?? null;
    if (!userId) {
      return NextResponse.json(
        { message: "Session user missing user_id" },
        { status: 400 }
      );
    }

    const url = new URL(req.url);
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");

    const today = new Date();
    const defaultFrom = new Date(today);
    defaultFrom.setDate(today.getDate() - 6);

    const fromDate = parseYMD(fromParam) ?? defaultFrom;
    const toDate = parseYMD(toParam) ?? today;

    const from = startOfDay(fromDate);
    const to = endOfDay(toDate);

    // 1) Clock logs in range
    const clockLogs = await prisma.d_tblclock_log.findMany({
      where: {
        user_id: String(userId),
        OR: [
          { shift_date: { gte: from, lte: to } },
          { clock_in_time: { gte: from, lte: to } },
        ],
      },
      orderBy: { clock_in_time: "desc" },
      select: {
        clock_id: true,
        shift_date: true,
        clock_in_time: true,
        clock_out_time: true,
        is_early_leave: true,
      },
    });

    // 2) Early reasons in range
    // If multiple reasons per day exist, keep the newest (orderBy desc + only set if not present).
    const earlyReasons = await prisma.d_tblearly_reasonlog.findMany({
      where: {
        user_id: String(userId),
        shift_date: { gte: from, lte: to },
      },
      orderBy: { reasonlog_id: "desc" },
      select: {
        shift_date: true,
        reason: true,
      },
    });

    const reasonByDay = new Map<string, string>();
    for (const r of earlyReasons) {
      if (!r.shift_date) continue;
      const key = toYMD(new Date(r.shift_date));
      if (!reasonByDay.has(key)) reasonByDay.set(key, (r.reason ?? "").trim());
    }

    // 3) Time logs in range
    const timeLogs = await prisma.d_tbltime_log.findMany({
      where: {
        user_id: String(userId),
        log_date: { gte: from, lte: to },
      },
      orderBy: [{ log_date: "desc" }, { start_time: "desc" }],
      select: {
        tlog_id: true,
        log_date: true,
        start_time: true,
        end_time: true,
        total_hours: true,
        approval_status: true,
        rejection_reason: true,
        activity_id: true,
        D_tblactivity: { select: { activity_name: true } },
      },
    });

    // Pre-group activities by day (so we don't filter inside a loop)
    const activitiesByDay = new Map<string, TimesheetDay["activities"]>();
    for (const t of timeLogs) {
      if (!t.log_date) continue;
      const key = toYMD(new Date(t.log_date));
      if (!activitiesByDay.has(key)) activitiesByDay.set(key, []);
      activitiesByDay.get(key)!.push({
        tlog_id: t.tlog_id,
        activity_id: t.activity_id ?? null,
        activity_name: t.D_tblactivity?.activity_name ?? null,
        start_time: t.start_time ?? null,
        end_time: t.end_time ?? null,
        total_hours: t.total_hours,
        approval_status: t.approval_status,
        rejection_reason: t.rejection_reason ?? null,
      });
    }

    // ✅ REAL structure: group everything by dayKey
    const dayMap = new Map<string, TimesheetDay>();

    for (const c of clockLogs) {
      const dayDate =
        c.shift_date
          ? new Date(c.shift_date)
          : c.clock_in_time
          ? new Date(c.clock_in_time)
          : new Date();

      const dayKey = toYMD(dayDate);

      if (!dayMap.has(dayKey)) {
        dayMap.set(dayKey, {
          date: dayKey,
          clocks: [],
          activities: activitiesByDay.get(dayKey) ?? [],
        });
      }

      dayMap.get(dayKey)!.clocks.push({
        clock_id: c.clock_id,
        shift_date: c.shift_date ?? null,
        clock_in_time: c.clock_in_time ?? null,
        clock_out_time: c.clock_out_time ?? null,
        is_early_leave: !!c.is_early_leave,
        early_reason: reasonByDay.get(dayKey) ?? null,
      });
    }

    // Include days that have activities but no clock logs (optional but good)
    for (const [dayKey, acts] of activitiesByDay.entries()) {
      if (!dayMap.has(dayKey)) {
        dayMap.set(dayKey, { date: dayKey, clocks: [], activities: acts });
      }
    }

    const days = Array.from(dayMap.values()).sort((a, b) =>
      a.date < b.date ? 1 : -1
    );

    return NextResponse.json({
      range: { from: toYMD(from), to: toYMD(to) },
      days,
    });
  } catch (err: any) {
    console.error("TIMESHEET_API_ERROR:", err);
    return NextResponse.json(
      { message: err?.message ?? "Timesheet API crashed" },
      { status: 500 }
    );
  }
}
