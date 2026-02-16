import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Format TIME field (stored as UTC Date) to HH:MM string
function formatTimeField(timeValue: Date | null): string | null {
  if (!timeValue) return null;
  const hours = timeValue.getUTCHours();
  const minutes = timeValue.getUTCMinutes();
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const userId = searchParams.get("userId"); // keep as string
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month")); // 0-based

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  // Fetch the active weekly schedule for the user
  const weeklySchedule = await prisma.d_tblweekly_schedule.findFirst({
    where: {
      user_id: userId, // string matches schema
      is_active: true,
    },
  });

  if (!weeklySchedule) {
    return NextResponse.json([]); // no schedule found
  }

  // Fetch all shift templates and map them by shift_id
  const shiftTemplates = await prisma.d_tblshift_template.findMany();
  const shiftMap: Record<string, typeof shiftTemplates[0]> = {};
  shiftTemplates.forEach((s) => {
    shiftMap[s.shift_id.toString()] = s;
  });

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const results: any[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const weekday = date.getDay();

    // Get the shift ID for the current weekday
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

    const shift = shiftId ? shiftMap[shiftId.toString()] : null;

    // Use local date components to avoid timezone shift issues
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    results.push({
      date: dateStr,
      off: !shift,
      shift_name: shift?.shift_name ?? null,
      start_time: shift ? formatTimeField(shift.start_time) : null,
      end_time: shift ? formatTimeField(shift.end_time) : null,
      activity: shift?.description ?? null,
    });
  }

  return NextResponse.json(results);
}
