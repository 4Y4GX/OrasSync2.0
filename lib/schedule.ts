import { prisma } from "@/lib/db";

export function formatTimeHHMM(input: string | Date): string {
  const d = typeof input === "string" ? new Date(input) : input;
  const hh = d.getUTCHours().toString().padStart(2, "0");
  const mm = d.getUTCMinutes().toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

// Convert a Date stored as TIME(0) into "today at that time"
// Note: Prisma returns TIME fields as UTC dates, so we need to use getUTC* methods
function timeToToday(timeValue: Date): Date {
  const now = new Date();
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    timeValue.getUTCHours(),
    timeValue.getUTCMinutes(),
    timeValue.getUTCSeconds(),
    0
  );
}

export async function getTodayShiftForUser(user_id: string) {
  const weekly = await prisma.d_tblweekly_schedule.findFirst({
    where: { user_id, is_active: true },
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

  if (!weekly) {
    return { hasSchedule: false, shift: null as any };
  }

  const day = new Date().getDay(); // 0=Sun..6=Sat
  const shiftId =
    day === 0
      ? weekly.sunday_shift_id
      : day === 1
      ? weekly.monday_shift_id
      : day === 2
      ? weekly.tuesday_shift_id
      : day === 3
      ? weekly.wednesday_shift_id
      : day === 4
      ? weekly.thursday_shift_id
      : day === 5
      ? weekly.friday_shift_id
      : weekly.saturday_shift_id;

  if (!shiftId) {
    return { hasSchedule: false, shift: null as any };
  }

  const shift = await prisma.d_tblshift_template.findFirst({
    where: { shift_id: shiftId },
    select: {
      shift_id: true,
      shift_name: true,
      start_time: true,
      end_time: true,
    },
  });

  if (!shift?.start_time || !shift?.end_time) {
    return { hasSchedule: false, shift: null as any };
  }

  const startToday = timeToToday(shift.start_time);
  let endToday = timeToToday(shift.end_time);

  // ✅ Fix overnight shifts (e.g., 22:00 → 06:00)
  if (endToday.getTime() <= startToday.getTime()) {
    endToday = new Date(endToday.getTime() + 24 * 60 * 60 * 1000);
  }

  return {
    hasSchedule: true,
    shift: {
      shift_name: shift.shift_name ?? null,
      start_time: startToday.toISOString(),
      end_time: endToday.toISOString(),
    },
  };
}
