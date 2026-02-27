import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromCookie } from "@/lib/auth";

// 🚨 KILL NEXT.JS CACHING
export const dynamic = "force-dynamic";
export const revalidate = 0; 

// ✅ FIX 1: Pure UTC extraction. 
// Prisma returns MySQL DATE fields as "YYYY-MM-DDT00:00:00.000Z".
// Using getUTCDate() guarantees the server's timezone won't accidentally shift it to "Yesterday".
function toYMD(d: Date) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// ✅ FIX 2: Pure UTC extraction for Time. 
// The DB already holds the exact face-value local time (e.g., 07:01). 
// We pull it straight out without adding any +8 hour offsets!
function formatTime(t: Date | null): string | null {
  if (!t) return null;
  const hh = String(t.getUTCHours()).padStart(2, "0");
  const mm = String(t.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function parseYMD(s: string | null) {
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`); // Parses strictly to Midnight UTC
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setUTCHours(23, 59, 59, 999);
  return x;
}

type TimesheetDay = {
  date: string;
  shift_id: number | null;
  shift_name: string | null;
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
    is_billable: boolean | null;
    start_time: string | null;  // HH:MM format
    end_time: string | null;    // HH:MM format
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
    const statusParam = url.searchParams.get("status"); 

    // ✅ FIX 3: Get the strict current date in Manila, avoiding Vercel server timezone gaps
    const manilaDateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date()); 
    
    const today = parseYMD(manilaDateStr) || new Date();
    const defaultFrom = new Date(today.getTime() - 6 * 86400000);

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
    let timeLogs = await prisma.d_tbltime_log.findMany({
      where: {
        user_id: String(userId),
        log_date: { gte: from, lte: to },
        ...(statusParam === "pending"
          ? { approval_status: "PENDING" }
          : statusParam === "rejected"
          ? { approval_status: "REJECTED" }
          : {}),
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
        D_tblactivity: { select: { activity_name: true, is_billable: true } },
      },
    });

    // 4) Fetch user's weekly schedule and shift templates
    const weeklySchedule = await prisma.d_tblweekly_schedule.findFirst({
      where: {
        user_id: String(userId),
        is_active: true,
      },
    });

    const shiftTemplates = await prisma.d_tblshift_template.findMany();
    const shiftMap: Record<number, { shift_id: number; shift_name: string | null }> = {};
    shiftTemplates.forEach((s) => {
      shiftMap[s.shift_id] = { shift_id: s.shift_id, shift_name: s.shift_name };
    });

    function getShiftForDate(dateStr: string): { shift_id: number | null; shift_name: string | null } {
      if (!weeklySchedule) return { shift_id: null, shift_name: null };
      
      const [yearStr, monthStr, dayStr] = dateStr.split('-');
      const date = new Date(Date.UTC(parseInt(yearStr), parseInt(monthStr) - 1, parseInt(dayStr)));
      const weekday = date.getUTCDay();
      
      let shiftId: number | null = null;
      switch (weekday) {
        case 0: shiftId = weeklySchedule.sunday_shift_id; break;
        case 1: shiftId = weeklySchedule.monday_shift_id; break;
        case 2: shiftId = weeklySchedule.tuesday_shift_id; break;
        case 3: shiftId = weeklySchedule.wednesday_shift_id; break;
        case 4: shiftId = weeklySchedule.thursday_shift_id; break;
        case 5: shiftId = weeklySchedule.friday_shift_id; break;
        case 6: shiftId = weeklySchedule.saturday_shift_id; break;
      }
      
      if (shiftId && shiftMap[shiftId]) {
        return shiftMap[shiftId];
      }
      return { shift_id: shiftId, shift_name: null };
    }

    const activitiesByDay = new Map<string, TimesheetDay["activities"]>();
    for (const t of timeLogs) {
      if (!t.log_date) continue;
      const key = toYMD(new Date(t.log_date));
      if (!activitiesByDay.has(key)) activitiesByDay.set(key, []);
      activitiesByDay.get(key)!.push({
        tlog_id: t.tlog_id,
        activity_id: t.activity_id ?? null,
        activity_name: t.D_tblactivity?.activity_name ?? null,
        is_billable: t.D_tblactivity?.is_billable ?? null,
        start_time: formatTime(t.start_time),
        end_time: formatTime(t.end_time),
        total_hours: t.total_hours,
        approval_status: t.approval_status,
        rejection_reason: t.rejection_reason ?? null,
      });
    }

    const dayMap = new Map<string, TimesheetDay>();

    for (const c of clockLogs) {
      // ✅ FIX 4: Safely deduce the day key based on shift date or clock in time
      let dayDate: Date;
      if (c.shift_date) {
        dayDate = new Date(c.shift_date);
      } else if (c.clock_in_time) {
        // Shift actual timestamp by +8 hours to align it with PHT before extracting the UTC Date
        dayDate = new Date(c.clock_in_time.getTime() + 8 * 3600 * 1000);
      } else {
        dayDate = new Date();
      }

      const dayKey = toYMD(dayDate);
      const shiftInfo = getShiftForDate(dayKey);

      if (!dayMap.has(dayKey)) {
        dayMap.set(dayKey, {
          date: dayKey,
          shift_id: shiftInfo.shift_id,
          shift_name: shiftInfo.shift_name,
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

    for (const [dayKey, acts] of activitiesByDay.entries()) {
      if (!dayMap.has(dayKey)) {
        const shiftInfo = getShiftForDate(dayKey);
        dayMap.set(dayKey, { 
          date: dayKey, 
          shift_id: shiftInfo.shift_id,
          shift_name: shiftInfo.shift_name,
          clocks: [], 
          activities: acts 
        });
      }
    }

    const days = Array.from(dayMap.values()).sort((a, b) =>
      a.date < b.date ? 1 : -1
    );

    return NextResponse.json({
      range: { from: toYMD(from), to: toYMD(to) },
      days,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
  } catch (err: any) {
    console.error("TIMESHEET_API_ERROR:", err);
    return NextResponse.json(
      { message: err?.message ?? "Timesheet API crashed" },
      { status: 500 }
    );
  }
}