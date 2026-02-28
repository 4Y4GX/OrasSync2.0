import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await getUserFromCookie();
    if (!user || user.role_id !== 4) {
      return NextResponse.json({ message: "Unauthorized. Supervisor access required." }, { status: 403 });
    }

    // Fetch future activities for all employees whose supervisor_id matches the user (join on D_tbluser)
    const futureSchedules = await prisma.d_tblfuture_schedule.findMany({
      where: {
        D_tbluser: {
          supervisor_id: user.user_id,
        },
      },
      include: {
        D_tblactivity: {
          select: {
            activity_id: true,
            activity_name: true,
            activity_code: true,
            is_billable: true,
          },
        },
        D_tbluser: {
          select: {
            user_id: true,
            first_name: true,
            last_name: true,
            supervisor_id: true,
          },
        },
      },
      orderBy: [
        { shift_date: "asc" },
        { start_time: "asc" },
      ],
    });

    // Format response
    const formatted = futureSchedules.map(schedule => ({
      fts_id: schedule.fts_id,
      user_id: schedule.user_id,
      employee_name: `${schedule.D_tbluser?.first_name ?? ''} ${schedule.D_tbluser?.last_name ?? ''}`.trim(),
      activity_id: schedule.activity_id,
      activity_name: schedule.D_tblactivity?.activity_name,
      activity_code: schedule.D_tblactivity?.activity_code,
      is_billable: schedule.D_tblactivity?.is_billable,
      shift_date: schedule.shift_date?.toISOString().split("T")[0],
      start_time: schedule.start_time ? `${schedule.start_time.getUTCHours().toString().padStart(2, '0')}:${schedule.start_time.getUTCMinutes().toString().padStart(2, '0')}` : '',
      end_time: schedule.end_time ? `${schedule.end_time.getUTCHours().toString().padStart(2, '0')}:${schedule.end_time.getUTCMinutes().toString().padStart(2, '0')}` : '',
      created_at: schedule.created_at,
    }));

    return NextResponse.json({ schedules: formatted });
  } catch (error) {
    console.error("Supervisor future schedule error:", error);
    return NextResponse.json({ message: "Failed to fetch future schedules" }, { status: 500 });
  }
}
