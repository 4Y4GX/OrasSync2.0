// app/api/supervisor/shifts/list/route.ts
import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getUserFromCookie();
    if (!user || (user.role_id !== 2 && user.role_id !== 3 && user.role_id !== 4)) {
      return NextResponse.json({ message: "Unauthorized. Supervisor access required." }, { status: 403 });
    }

    // Get all shift templates (sorted earliest → latest)
    const shifts = await prisma.d_tblshift_template.findMany({
      select: { shift_id: true, shift_name: true, start_time: true, end_time: true },
      orderBy: { start_time: "asc" },
    });

    const formatTime = (dateObj: Date | null) => {
      if (!dateObj) return '';
      return new Date(dateObj).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
    };

    const formattedShifts = shifts.map(shift => ({
      shift_id: shift.shift_id,
      shift_name: shift.shift_name,
      time_string: `${formatTime(shift.start_time)} - ${formatTime(shift.end_time)}`,
      _startHour: shift.start_time ? new Date(shift.start_time).getUTCHours() : 0,
    }));

    // Push overnight shifts (start before 6 AM) to the end of the list
    formattedShifts.sort((a, b) => {
      const aIsOvernight = a._startHour < 6;
      const bIsOvernight = b._startHour < 6;
      if (aIsOvernight && !bIsOvernight) return 1;
      if (!aIsOvernight && bIsOvernight) return -1;
      return 0; // preserve DB order within each group
    });

    // Strip internal field before sending
    const result = formattedShifts.map(({ _startHour, ...rest }) => rest);

    return NextResponse.json({ shifts: result });
  } catch (error) {
    console.error("List shifts error:", error);
    return NextResponse.json({ message: "Failed to fetch shifts" }, { status: 500 });
  }
}
