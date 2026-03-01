import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromCookie } from "@/lib/auth";

export async function POST(req: Request) {
  const user = await getUserFromCookie();

  if (!user || (user.role_id !== 5 && user.role_id !== 4)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();

    // 1. FULL WEEK UPDATE (From Assign Schedule feature)
    if (body.schedule_id !== undefined) {
      const {
        schedule_id,
        monday_shift_id,
        tuesday_shift_id,
        wednesday_shift_id,
        thursday_shift_id,
        friday_shift_id,
        saturday_shift_id,
        sunday_shift_id,
      } = body;

      const existingSchedule = await prisma.d_tblweekly_schedule.findUnique({
        where: { schedule_id: Number(schedule_id) },
      });

      if (!existingSchedule) {
        return NextResponse.json({ message: "Schedule not found" }, { status: 404 });
      }

      const updatedSchedule = await prisma.d_tblweekly_schedule.update({
        where: { schedule_id: Number(schedule_id) },
        data: {
          monday_shift_id: monday_shift_id !== undefined ? monday_shift_id : existingSchedule.monday_shift_id,
          tuesday_shift_id: tuesday_shift_id !== undefined ? tuesday_shift_id : existingSchedule.tuesday_shift_id,
          wednesday_shift_id: wednesday_shift_id !== undefined ? wednesday_shift_id : existingSchedule.wednesday_shift_id,
          thursday_shift_id: thursday_shift_id !== undefined ? thursday_shift_id : existingSchedule.thursday_shift_id,
          friday_shift_id: friday_shift_id !== undefined ? friday_shift_id : existingSchedule.friday_shift_id,
          saturday_shift_id: saturday_shift_id !== undefined ? saturday_shift_id : existingSchedule.saturday_shift_id,
          sunday_shift_id: sunday_shift_id !== undefined ? sunday_shift_id : existingSchedule.sunday_shift_id,
        },
      });

      await prisma.d_tblaudit_log.create({
        data: {
          changed_by: user.user_id,
          action_type: "UPDATE_SCHEDULE_MANAGER",
          table_affected: "D_tblweekly_schedule",
          old_value: `Schedule ID: ${schedule_id}`,
          new_value: `Updated shifts by manager for user: ${existingSchedule.user_id}`,
        },
      });

      return NextResponse.json({ message: "Schedule updated successfully", schedule: updatedSchedule });
    }

    // 2. SINGLE DAY UPDATE (Legacy feature)
    const { targetUserId, day, newShiftId } = body;
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