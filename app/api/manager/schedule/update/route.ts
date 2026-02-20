import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromCookie } from "@/lib/auth";

export async function POST(req: Request) {
  const user = await getUserFromCookie();
  
  if (!user || (user.role_id !== 5 && user.role_id !== 4)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const { targetUserId, day, newShiftId } = await req.json();

    if (!targetUserId || !day || !newShiftId) {
        return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
    }

    // Map the UI day abbreviation to the actual database column name
    const dayKeyMap: Record<string, string> = { 
        'Mon': 'monday_shift_id', 
        'Tue': 'tuesday_shift_id', 
        'Wed': 'wednesday_shift_id', 
        'Thu': 'thursday_shift_id', 
        'Fri': 'friday_shift_id', 
        'Sat': 'saturday_shift_id', 
        'Sun': 'sunday_shift_id' 
    };
    
    const dbColumn = dayKeyMap[day];

    // Find the user's current ACTIVE weekly schedule
    const activeSchedule = await prisma.d_tblweekly_schedule.findFirst({
        where: { user_id: targetUserId, is_active: true }
    });

    if (!activeSchedule) {
        return NextResponse.json({ message: "No active schedule found for this employee." }, { status: 404 });
    }

    // Update that specific day's column with the new shift ID (or null if "OFF" is selected)
    await prisma.d_tblweekly_schedule.update({
        where: { schedule_id: activeSchedule.schedule_id },
        data: {
            [dbColumn]: newShiftId === 'OFF' ? null : Number(newShiftId)
        }
    });

    return NextResponse.json({ message: "Schedule updated successfully" });

  } catch (error) {
    console.error("Update Schedule Error:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}