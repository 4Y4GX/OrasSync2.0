// app/api/supervisor/schedules/delete/route.ts
import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request) {
  try {
    const user = await getUserFromCookie();
    if (!user || (user.role_id !== 2 && user.role_id !== 3 && user.role_id !== 4)) {
      return NextResponse.json({ message: "Unauthorized. Supervisor access required." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const schedule_id = searchParams.get("schedule_id");

    if (!schedule_id) {
      return NextResponse.json({ message: "Schedule ID is required" }, { status: 400 });
    }

    // Get existing schedule
    const existingSchedule = await prisma.d_tblweekly_schedule.findUnique({
      where: { schedule_id: parseInt(schedule_id) },
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

    // Soft delete by setting is_active to false
    await prisma.d_tblweekly_schedule.update({
      where: { schedule_id: parseInt(schedule_id) },
      data: { is_active: false },
    });

    // Create audit log
    await prisma.d_tblaudit_log.create({
      data: {
        changed_by: user.user_id,
        action_type: "DELETE_SCHEDULE",
        table_affected: "D_tblweekly_schedule",
        old_value: JSON.stringify(existingSchedule),
        new_value: `Schedule deactivated for user: ${existingSchedule.user_id}`,
      },
    });

    return NextResponse.json({
      message: "Schedule deleted successfully",
    });
  } catch (error) {
    console.error("Delete schedule error:", error);
    return NextResponse.json({ message: "Failed to delete schedule" }, { status: 500 });
  }
}
