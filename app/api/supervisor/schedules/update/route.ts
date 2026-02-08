// app/api/supervisor/schedules/update/route.ts
import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  try {
    const user = await getUserFromCookie();
    if (!user || (user.role_id !== 2 && user.role_id !== 3 && user.role_id !== 4)) {
      return NextResponse.json({ message: "Unauthorized. Supervisor access required." }, { status: 403 });
    }

    const body = await request.json();
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

    if (!schedule_id) {
      return NextResponse.json({ message: "Schedule ID is required" }, { status: 400 });
    }

    // Get existing schedule
    const existingSchedule = await prisma.d_tblweekly_schedule.findUnique({
      where: { schedule_id },
      include: {
        D_tbluser: {
          select: {
            user_id: true,
            supervisor_id: true,
          },
        },
      },
    });

    if (!existingSchedule) {
      return NextResponse.json({ message: "Schedule not found" }, { status: 404 });
    }

    // Authorization check for supervisors
    if (user.role_id === 2 && existingSchedule.D_tbluser?.supervisor_id !== user.user_id) {
      return NextResponse.json({ message: "Unauthorized. You can only manage schedules for your team members." }, { status: 403 });
    }

    // Update schedule
    const updatedSchedule = await prisma.d_tblweekly_schedule.update({
      where: { schedule_id },
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

    // Create audit log
    await prisma.d_tblaudit_log.create({
      data: {
        changed_by: user.user_id,
        action_type: "UPDATE_SCHEDULE",
        table_affected: "D_tblweekly_schedule",
        old_value: JSON.stringify(existingSchedule),
        new_value: JSON.stringify(updatedSchedule),
      },
    });

    return NextResponse.json({
      message: "Schedule updated successfully",
      schedule: updatedSchedule,
    });
  } catch (error) {
    console.error("Update schedule error:", error);
    return NextResponse.json({ message: "Failed to update schedule" }, { status: 500 });
  }
}
